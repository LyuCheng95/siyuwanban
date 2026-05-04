param([switch]$NoTunnel)

$Server        = "root@168.144.108.9"
$WorkerPort    = 7080
$ComfyPort     = 8188
$WorkerDir     = "$PSScriptRoot\image-worker"
$CheckInterval = 20

# ── log helpers ───────────────────────────────────────────────────────────────
function wlog([string]$Tag, [string]$Msg, [string]$Color = "White") {
    $t = Get-Date -Format "HH:mm:ss"
    Write-Host "  $t  " -NoNewline -ForegroundColor DarkGray
    Write-Host $Tag.PadRight(9) -NoNewline -ForegroundColor $Color
    Write-Host " $Msg"
}
function lok  ([string]$t,[string]$m) { wlog $t $m "Green"   }
function lerr ([string]$t,[string]$m) { wlog $t $m "Red"     }
function lwarn([string]$t,[string]$m) { wlog $t $m "Yellow"  }
function linfo([string]$t,[string]$m) { wlog $t $m "Cyan"    }
function ldim ([string]$t,[string]$m) { wlog $t $m "DarkGray"}
function div  { Write-Host ("  " + "-" * 58) -ForegroundColor DarkGray }

# ── banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  +====================================================+" -ForegroundColor Magenta
Write-Host "  |       Si Yu Wan Ban  --  Worker Hub               |" -ForegroundColor Magenta
Write-Host "  +====================================================+" -ForegroundColor Magenta
Write-Host ""
linfo "start" (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
div

# ── deps ──────────────────────────────────────────────────────────────────────
Write-Host ""
if (-not (Test-Path "$WorkerDir\node_modules")) {
    lwarn "npm" "first run — installing..."
    Push-Location $WorkerDir
    npm install --silent
    Pop-Location
    lok "npm" "done"
} else {
    lok "deps" "node_modules OK"
}

if ((-not (Test-Path "$WorkerDir\.env")) -and (Test-Path "$WorkerDir\.env.example")) {
    Copy-Item "$WorkerDir\.env.example" "$WorkerDir\.env"
    lwarn "env" "created .env from example — check WORKER_KEY"
}

# ── comfyui check ─────────────────────────────────────────────────────────────
div
Write-Host ""
try {
    $null = Invoke-WebRequest -Uri "http://localhost:$ComfyPort" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    lok "comfyui" "running  ->  http://localhost:$ComfyPort"
} catch {
    lwarn "comfyui" "not detected (start ComfyUI first for image gen)"
}

# ── ssh tunnel ────────────────────────────────────────────────────────────────
$tunnelProc = $null
$sshArgs    = @("-N","-o","ServerAliveInterval=30","-o","ServerAliveCountMax=3",
                "-R","${WorkerPort}:localhost:${WorkerPort}",$Server)
div
Write-Host ""
if ($NoTunnel) {
    lwarn "tunnel" "skipped (-NoTunnel)"
} else {
    linfo "tunnel" "opening reverse tunnel  server:$WorkerPort -> local:$WorkerPort"
    $tunnelProc = Start-Process ssh -ArgumentList $sshArgs -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    if ($tunnelProc.HasExited) { lerr "tunnel" "failed (check SSH)" }
    else                       { lok  "tunnel" "up  PID=$($tunnelProc.Id)" }
}

# ── worker ────────────────────────────────────────────────────────────────────
div
Write-Host ""
linfo "worker" "starting  ->  http://localhost:$WorkerPort"
Write-Host ""

$outFile = "$env:TEMP\sywb-worker-out.log"
$errFile = "$env:TEMP\sywb-worker-err.log"
"" | Set-Content -Path $outFile -Encoding UTF8
"" | Set-Content -Path $errFile -Encoding UTF8

$tsxPath = "$WorkerDir\node_modules\.bin\tsx"

function Start-Worker {
    $p = Start-Process -FilePath $tsxPath `
        -ArgumentList "server.ts" `
        -WorkingDirectory $WorkerDir `
        -RedirectStandardOutput $outFile `
        -RedirectStandardError  $errFile `
        -PassThru -WindowStyle Hidden
    return $p
}

$workerProc = Start-Worker
$outReader  = New-Object System.IO.StreamReader($outFile, [System.Text.Encoding]::UTF8)
$errReader  = New-Object System.IO.StreamReader($errFile, [System.Text.Encoding]::UTF8)
$lastCheck  = [DateTime]::MinValue

# ── main loop ─────────────────────────────────────────────────────────────────
try {
    while ($true) {

        # forward worker stdout
        $line = $outReader.ReadLine()
        while ($null -ne $line) {
            $l = [string]$line
            if ($l.Trim() -ne "") {
                if     ($l -match "error|Error|ERROR|failed|FAILED") { lerr  "worker" $l }
                elseif ($l -match "warn|WARN")                       { lwarn "worker" $l }
                elseif ($l -match "listen|started|ready|running")    { lok   "worker" $l }
                elseif ($l -match "queue|job|generat|comfy|image")   { linfo "image"  $l }
                elseif ($l -match "notify|callback|upload")          { lok   "upload" $l }
                else                                                  { ldim  "worker" $l }
            }
            $line = $outReader.ReadLine()
        }
        # forward worker stderr
        $eline = $errReader.ReadLine()
        while ($null -ne $eline) {
            $l = [string]$eline
            if ($l.Trim() -ne "") { lerr "worker" $l }
            $eline = $errReader.ReadLine()
        }

        # restart if crashed
        if ($workerProc.HasExited) {
            lerr "worker" "exited (code=$($workerProc.ExitCode)) — restarting in 5s..."
            Start-Sleep -Seconds 5
            "" | Set-Content -Path $outFile -Encoding UTF8
            "" | Set-Content -Path $errFile -Encoding UTF8
            $outReader.Close(); $errReader.Close()
            $outReader = New-Object System.IO.StreamReader($outFile, [System.Text.Encoding]::UTF8)
            $errReader = New-Object System.IO.StreamReader($errFile, [System.Text.Encoding]::UTF8)
            $workerProc = Start-Worker
            linfo "worker" "restarted  PID=$($workerProc.Id)"
        }

        # health check
        $now = [DateTime]::Now
        if (($now - $lastCheck).TotalSeconds -ge $CheckInterval) {
            $lastCheck = $now
            $parts = @()

            try {
                $null = Invoke-WebRequest -Uri "http://localhost:$ComfyPort" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                $parts += "ComfyUI[OK]"
            } catch { $parts += "ComfyUI[--]" }

            try {
                $null = Invoke-WebRequest -Uri "http://localhost:$WorkerPort/ping" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                $parts += "Worker[OK]"
            } catch { $parts += "Worker[--]" }

            if (-not $NoTunnel) {
                if ($tunnelProc -and -not $tunnelProc.HasExited) {
                    $parts += "Tunnel[OK]"
                } else {
                    lwarn "tunnel" "dropped — rebuilding..."
                    $tunnelProc = Start-Process ssh -ArgumentList $sshArgs -PassThru -WindowStyle Hidden
                    $parts += "Tunnel[rebuild]"
                }
            }

            linfo "health" ($parts -join "  |  ")
        }

        Start-Sleep -Milliseconds 300
    }
} finally {
    Write-Host ""
    div
    lwarn "stop" "cleaning up..."
    $outReader.Close(); $errReader.Close()
    if ($workerProc -and -not $workerProc.HasExited) {
        Stop-Process -Id $workerProc.Id -Force -ErrorAction SilentlyContinue
        lok "worker" "stopped"
    }
    if ($tunnelProc -and -not $tunnelProc.HasExited) {
        Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue
        lok "tunnel" "closed"
    }
    Write-Host ""
    lok "bye" "goodbye!"
    Write-Host ""
}
