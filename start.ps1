# ╔══════════════════════════════════════════════════════════════╗
# ║            私欲玩伴 — Local Services Launcher               ║
# ║  一键启动：SSH 反向隧道 + 图片生成 Worker + 状态监控        ║
# ╚══════════════════════════════════════════════════════════════╝
#
# 用法：
#   .\start.ps1                  正常启动全部服务
#   .\start.ps1 -NoTunnel        跳过 SSH 隧道（隧道已在其他地方运行时）

param([switch]$NoTunnel)

# ── 配置 ─────────────────────────────────────────────────────────────────────
$Server       = "root@168.144.108.9"
$WorkerPort   = 7080
$ComfyPort    = 8188
$WorkerDir    = "$PSScriptRoot\image-worker"
$CheckInterval = 20   # 秒：健康检查间隔

# ── 颜色/日志工具 ────────────────────────────────────────────────────────────
function ts { Get-Date -Format "HH:mm:ss" }

function log {
    param($Tag, $Msg, $Color = "White")
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "  " -NoNewline
    Write-Host $time -ForegroundColor DarkGray -NoNewline
    Write-Host "  " -NoNewline
    Write-Host $Tag -ForegroundColor $Color -NoNewline
    Write-Host "  $Msg" -ForegroundColor White
}

function log-ok  { param($Tag,$Msg) log $Tag $Msg "Green"   }
function log-err { param($Tag,$Msg) log $Tag $Msg "Red"     }
function log-warn{ param($Tag,$Msg) log $Tag $Msg "Yellow"  }
function log-info{ param($Tag,$Msg) log $Tag $Msg "Cyan"    }

function divider { Write-Host ("  " + ("─" * 60)) -ForegroundColor DarkGray }

# ── Banner ───────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║          私  欲  玩  伴   —   Worker                ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
log-info "系统" "启动时间 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
divider
Write-Host ""

# ── 检查依赖 ─────────────────────────────────────────────────────────────────
log-info "检查" "node_modules..."
if (-not (Test-Path "$WorkerDir\node_modules")) {
    log-warn "安装" "首次运行，安装依赖..."
    Push-Location $WorkerDir
    npm install --silent
    Pop-Location
    log-ok "安装" "依赖安装完成"
} else {
    log-ok "检查" "依赖已就绪"
}

# 复制 .env
if (-not (Test-Path "$WorkerDir\.env")) {
    if (Test-Path "$WorkerDir\.env.example") {
        Copy-Item "$WorkerDir\.env.example" "$WorkerDir\.env"
        log-warn "配置" "已创建 .env，请确认 WORKER_KEY 和 ADMIN_KEY"
    }
}

# ── ComfyUI 检查 ──────────────────────────────────────────────────────────────
Write-Host ""
divider
log-info "ComfyUI" "检查本地 ComfyUI（端口 $ComfyPort）..."
try {
    $r = Invoke-WebRequest "http://localhost:$ComfyPort" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    log-ok  "ComfyUI" "✓ 运行中  →  http://localhost:$ComfyPort"
} catch {
    log-warn "ComfyUI" "✗ 未检测到（图片生成将失败，请先启动 ComfyUI）"
}

# ── SSH 隧道 ──────────────────────────────────────────────────────────────────
$tunnelProc = $null
if (-not $NoTunnel) {
    Write-Host ""
    divider
    log-info "隧道" "建立 SSH 反向隧道  server:$WorkerPort → 本机:$WorkerPort"
    $tunnelProc = Start-Process -FilePath "ssh" `
        -ArgumentList "-N", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3", `
                      "-R", "${WorkerPort}:localhost:${WorkerPort}", $Server `
        -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    if ($tunnelProc.HasExited) {
        log-err "隧道" "✗ 启动失败（检查 SSH 配置 / 服务器连接）"
    } else {
        log-ok  "隧道" "✓ 隧道已建立  PID=$($tunnelProc.Id)"
    }
} else {
    log-warn "隧道" "跳过（-NoTunnel 模式）"
}

# ── 启动 Worker ───────────────────────────────────────────────────────────────
Write-Host ""
divider
log-info "Worker" "启动图片生成服务  →  http://localhost:$WorkerPort"
Write-Host ""

# 用 Job 启动 worker 并转发输出
$workerJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & npm start 2>&1
} -ArgumentList $WorkerDir

# ── 主循环：输出转发 + 健康监控 ──────────────────────────────────────────────
$lastCheck = [DateTime]::MinValue
$workerReady = $false

try {
    while ($true) {
        # 转发 worker 输出
        $lines = Receive-Job -Job $workerJob
        foreach ($line in $lines) {
            if (-not $line) { continue }
            $l = "$line"

            # 按关键词着色
            if ($l -match "error|Error|ERROR|failed|FAILED") {
                log-err  "Worker" $l
            } elseif ($l -match "warn|WARN|warning") {
                log-warn "Worker" $l
            } elseif ($l -match "port|listening|started|ready|online|\d{4}") {
                if (-not $workerReady) { $workerReady = $true }
                log-ok   "Worker" $l
            } elseif ($l -match "queue|job|generating|comfy|image") {
                log-info "生图" $l
            } elseif ($l -match "notify|callback|upload") {
                log-ok   "回传" $l
            } else {
                log      "Worker" $l "DarkGray"
            }
        }

        # Worker 挂掉则自动重启
        if ($workerJob.State -eq "Failed" -or $workerJob.State -eq "Completed") {
            log-err "Worker" "进程意外退出，5 秒后重启..."
            Remove-Job -Job $workerJob -Force
            Start-Sleep -Seconds 5
            $workerJob = Start-Job -ScriptBlock {
                param($dir)
                Set-Location $dir
                & npm start 2>&1
            } -ArgumentList $WorkerDir
            log-info "Worker" "已重启"
        }

        # 定期健康检查
        $now = [DateTime]::Now
        if (($now - $lastCheck).TotalSeconds -ge $CheckInterval) {
            $lastCheck = $now
            $status = @()

            # ComfyUI
            try {
                Invoke-WebRequest "http://localhost:$ComfyPort" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop | Out-Null
                $status += "ComfyUI ✓"
            } catch {
                $status += "ComfyUI ✗"
            }

            # Worker
            try {
                Invoke-WebRequest "http://localhost:$WorkerPort/ping" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop | Out-Null
                $status += "Worker ✓"
            } catch {
                $status += "Worker ✗"
            }

            # 隧道
            if ($tunnelProc -and -not $tunnelProc.HasExited) {
                $status += "隧道 ✓"
            } elseif (-not $NoTunnel) {
                $status += "隧道 ✗ 重建中..."
                $tunnelProc = Start-Process -FilePath "ssh" `
                    -ArgumentList "-N", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3", `
                                  "-R", "${WorkerPort}:localhost:${WorkerPort}", $Server `
                    -PassThru -WindowStyle Hidden
            }

            $statusLine = $status -join "  │  "
            log-info "状态" "[$statusLine]  $(Get-Date -Format 'HH:mm:ss')"
        }

        Start-Sleep -Milliseconds 300
    }
} finally {
    # Ctrl+C 清理
    Write-Host ""
    divider
    log-warn "退出" "正在清理进程..."
    if ($workerJob) { Remove-Job -Job $workerJob -Force -ErrorAction SilentlyContinue }
    if ($tunnelProc -and -not $tunnelProc.HasExited) {
        Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue
        log-ok "隧道" "已关闭"
    }
    log-ok "退出" "再见！"
    Write-Host ""
}
