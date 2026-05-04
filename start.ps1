# 私欲玩伴 — Local Services Launcher
# 用法: .\start.ps1            启动全部服务
#       .\start.ps1 -NoTunnel  跳过 SSH 隧道

param([switch]$NoTunnel)

# ── 配置 ──────────────────────────────────────────────────────────────────────
$Server        = "root@168.144.108.9"
$WorkerPort    = 7080
$ComfyPort     = 8188
$WorkerDir     = "$PSScriptRoot\image-worker"
$CheckInterval = 20   # 秒

# ── 日志工具 ─────────────────────────────────────────────────────────────────
function wlog([string]$Tag, [string]$Msg, [string]$Color = "White") {
    $t = Get-Date -Format "HH:mm:ss"
    Write-Host "  " -NoNewline
    Write-Host $t -ForegroundColor DarkGray -NoNewline
    Write-Host "  " -NoNewline
    $padded = $Tag.PadRight(8)
    Write-Host $padded -ForegroundColor $Color -NoNewline
    Write-Host " $Msg"
}
function ok   ([string]$Tag, [string]$Msg) { wlog $Tag $Msg "Green"   }
function err  ([string]$Tag, [string]$Msg) { wlog $Tag $Msg "Red"     }
function warn ([string]$Tag, [string]$Msg) { wlog $Tag $Msg "Yellow"  }
function info ([string]$Tag, [string]$Msg) { wlog $Tag $Msg "Cyan"    }
function dim  ([string]$Tag, [string]$Msg) { wlog $Tag $Msg "DarkGray"}
function div  { Write-Host ("  " + [string]::new([char]0x2500, 58)) -ForegroundColor DarkGray }

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  +==================================================+" -ForegroundColor Magenta
Write-Host "  |        私  欲  玩  伴     Worker  Hub           |" -ForegroundColor Magenta
Write-Host "  +==================================================+" -ForegroundColor Magenta
Write-Host ""
info "启动" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
div

# ── 依赖检查 ──────────────────────────────────────────────────────────────────
Write-Host ""
if (-not (Test-Path "$WorkerDir\node_modules")) {
    warn "安装" "首次运行，安装 node_modules..."
    Push-Location $WorkerDir
    npm install --silent
    Pop-Location
    ok "安装" "依赖安装完成"
} else {
    ok "依赖" "node_modules 已就绪"
}

if (-not (Test-Path "$WorkerDir\.env")) {
    if (Test-Path "$WorkerDir\.env.example") {
        Copy-Item "$WorkerDir\.env.example" "$WorkerDir\.env"
        warn "配置" "已创建 .env，请确认 WORKER_KEY 和 ADMIN_KEY"
    }
}

# ── ComfyUI 检测 ──────────────────────────────────────────────────────────────
div
Write-Host ""
$comfyUrl = "http://localhost:$ComfyPort"
try {
    $null = Invoke-WebRequest -Uri $comfyUrl -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    ok "ComfyUI" "运行中  ->  $comfyUrl"
} catch {
    warn "ComfyUI" "未检测到 (请先启动 ComfyUI，图片生成暂不可用)"
}

# ── SSH 隧道 ──────────────────────────────────────────────────────────────────
$tunnelProc = $null
div
Write-Host ""
if ($NoTunnel) {
    warn "隧道" "跳过 (-NoTunnel 模式)"
} else {
    info "隧道" "建立反向隧道  server:$WorkerPort -> 本机:$WorkerPort"
    $sshArgs = @("-N", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3",
                 "-R", "${WorkerPort}:localhost:${WorkerPort}", $Server)
    $tunnelProc = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    if ($tunnelProc.HasExited) {
        err "隧道" "启动失败 (检查 SSH 配置)"
    } else {
        ok "隧道" "已建立  PID=$($tunnelProc.Id)"
    }
}

# ── Worker 进程 ───────────────────────────────────────────────────────────────
div
Write-Host ""
info "Worker" "启动图片生成服务  ->  http://localhost:$WorkerPort"
Write-Host ""

# 输出写到临时文件，主循环来 tail
$outFile = "$env:TEMP\sywb-worker.log"
"" | Set-Content -Path $outFile -Encoding UTF8

$tsxPath = "$WorkerDir\node_modules\.bin\tsx"
$workerProc = Start-Process -FilePath $tsxPath `
    -ArgumentList "server.ts" `
    -WorkingDirectory $WorkerDir `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError  $outFile `
    -PassThru -WindowStyle Hidden

Start-Sleep -Milliseconds 800

function Start-Worker {
    $p = Start-Process -FilePath $tsxPath `
        -ArgumentList "server.ts" `
        -WorkingDirectory $WorkerDir `
        -RedirectStandardOutput $outFile `
        -RedirectStandardError  $outFile `
        -PassThru -WindowStyle Hidden
    return $p
}

# ── 主循环 ─────────────────────────────────────────────────────────────────────
$reader    = New-Object System.IO.StreamReader($outFile, [System.Text.Encoding]::UTF8)
$lastCheck = [DateTime]::MinValue

try {
    while ($true) {
        # 读 worker 输出
        $line = $reader.ReadLine()
        while ($null -ne $line) {
            $l = [string]$line
            if ($l.Trim() -ne "") {
                if ($l -match "error|Error|ERROR|failed|FAILED") {
                    err "Worker" $l
                } elseif ($l -match "warn|WARN|warning") {
                    warn "Worker" $l
                } elseif ($l -match "port|listen|started|ready|running") {
                    ok "Worker" $l
                } elseif ($l -match "queue|job|generat|comfy|image") {
                    info "生图" $l
                } elseif ($l -match "notify|callback|upload|server") {
                    ok "回传" $l
                } else {
                    dim "Worker" $l
                }
            }
            $line = $reader.ReadLine()
        }

        # Worker 挂掉自动重启
        if ($workerProc.HasExited) {
            err "Worker" "进程退出 (code=$($workerProc.ExitCode))，5 秒后重启..."
            Start-Sleep -Seconds 5
            "" | Set-Content -Path $outFile -Encoding UTF8
            $reader.Close()
            $reader = New-Object System.IO.StreamReader($outFile, [System.Text.Encoding]::UTF8)
            $workerProc = Start-Worker
            info "Worker" "已重启  PID=$($workerProc.Id)"
        }

        # 定期健康检查
        $now = [DateTime]::Now
        if (($now - $lastCheck).TotalSeconds -ge $CheckInterval) {
            $lastCheck = $now
            $parts = @()

            # ComfyUI
            try {
                $null = Invoke-WebRequest -Uri "http://localhost:$ComfyPort" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                $parts += "ComfyUI [OK]"
            } catch {
                $parts += "ComfyUI [--]"
            }

            # Worker
            try {
                $pingUrl = "http://localhost:$WorkerPort/ping"
                $null = Invoke-WebRequest -Uri $pingUrl -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                $parts += "Worker [OK]"
            } catch {
                $parts += "Worker [--]"
            }

            # 隧道
            if (-not $NoTunnel) {
                if ($tunnelProc -and -not $tunnelProc.HasExited) {
                    $parts += "隧道 [OK]"
                } else {
                    warn "隧道" "连接断开，重建中..."
                    $tunnelProc = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -PassThru -WindowStyle Hidden
                    $parts += "隧道 [重建]"
                }
            }

            info "状态" ($parts -join "  |  ")
        }

        Start-Sleep -Milliseconds 300
    }
} finally {
    Write-Host ""
    div
    warn "退出" "正在清理..."
    $reader.Close()
    if ($workerProc -and -not $workerProc.HasExited) {
        Stop-Process -Id $workerProc.Id -Force -ErrorAction SilentlyContinue
        ok "Worker" "已停止"
    }
    if ($tunnelProc -and -not $tunnelProc.HasExited) {
        Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue
        ok "隧道" "已关闭"
    }
    Write-Host ""
    ok "完成" "再见！"
    Write-Host ""
}
