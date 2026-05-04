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

# Kill entire process tree (cmd.exe + npm + tsx + node children)
function Stop-Tree([int]$procId) {
    $null = taskkill /F /T /PID $procId 2>&1
}

# Kill any process listening on port 7080
function Clear-Port {
    $lines = @(netstat -ano | Select-String ":$WorkerPort\s")
    foreach ($line in $lines) {
        $parts = $line.ToString().Trim() -split '\s+'
        $p = $parts[-1]
        if ($p -match '^\d+$' -and [int]$p -gt 4) {
            Stop-Tree ([int]$p)
            lwarn "port" "killed stale process $p on :$WorkerPort"
        }
    }
}

# Create fresh log files using .NET (avoids Set-Content lock)
function New-LogPair {
    $tag = Get-Date -Format 'HHmmssff'
    $o = "$env:TEMP\sywb-out-$tag.log"
    $e = "$env:TEMP\sywb-err-$tag.log"
    [System.IO.File]::WriteAllText($o, "", [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($e, "", [System.Text.Encoding]::UTF8)
    return @($o, $e)
}

function Open-LogReader([string]$path) {
    $fs = New-Object System.IO.FileStream(
        $path,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite)
    return New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
}

function Start-Worker([string]$outF, [string]$errF) {
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm start" `
        -WorkingDirectory $WorkerDir `
        -RedirectStandardOutput $outF `
        -RedirectStandardError  $errF `
        -PassThru -WindowStyle Hidden
    return $p
}

# ── banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  +====================================================+" -ForegroundColor Magenta
Write-Host "  |       Si Yu Wan Ban  --  Worker Hub               |" -ForegroundColor Magenta
Write-Host "  +====================================================+" -ForegroundColor Magenta
Write-Host ""
linfo "start" (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
div

# ── kill stale port 7080 ──────────────────────────────────────────────────────
Write-Host ""
Clear-Port

# ── deps ──────────────────────────────────────────────────────────────────────
Write-Host ""
if (-not (Test-Path "$WorkerDir\node_modules")) {
    lwarn "npm" "first run - installing..."
    Push-Location $WorkerDir
    npm install --silent
    Pop-Location
    lok "npm" "done"
} else {
    lok "deps" "node_modules OK"
}

if ((-not (Test-Path "$WorkerDir\.env")) -and (Test-Path "$WorkerDir\.env.example")) {
    Copy-Item "$WorkerDir\.env.example" "$WorkerDir\.env"
    lwarn "env" "created .env from example - check WORKER_KEY"
}

# ── comfyui auto-start ────────────────────────────────────────────────────────
$CondaPath = "C:\Users\Administrator\miniconda3\Scripts\activate.bat"
$ComfyDir  = "D:\SD\ComfyUI"
div
Write-Host ""
$comfyRunning = $false
try {
    $null = Invoke-WebRequest -Uri "http://localhost:$ComfyPort" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    lok "comfyui" "already running  ->  http://localhost:$ComfyPort"
    $comfyRunning = $true
} catch { }

if (-not $comfyRunning) {
    linfo "comfyui" "starting (conda: comfyui) - output shown until ready..."
    $comfyPair = New-LogPair
    $comfyOut  = $comfyPair[0]
    $comfyErr  = $comfyPair[1]
    $comfyCmd  = "call `"$CondaPath`" comfyui && cd /d `"$ComfyDir`" && python main.py --listen 0.0.0.0 --port $ComfyPort"
    $comfyProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", $comfyCmd `
        -RedirectStandardOutput $comfyOut `
        -RedirectStandardError  $comfyErr `
        -PassThru -WindowStyle Hidden
    linfo "comfyui" "PID=$($comfyProc.Id)"
    $comfyOutR = Open-LogReader $comfyOut
    $comfyErrR = Open-LogReader $comfyErr
    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        # drain and display comfyui output
        $cl = $comfyOutR.ReadLine()
        while ($null -ne $cl) {
            $s = $cl.Trim()
            if ($s -and $s -notmatch "^Traceback|^\s+File ") {
                if   ($s -match "error|Error|ERROR|fail") { lerr  "comfyui" $s }
                else                                      { ldim  "comfyui" $s }
            }
            $cl = $comfyOutR.ReadLine()
        }
        $cel = $comfyErrR.ReadLine()
        while ($null -ne $cel) {
            $s = $cel.Trim()
            if ($s -and $s -notmatch "^Traceback|^\s+File ") { ldim "comfyui" $s }
            $cel = $comfyErrR.ReadLine()
        }
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$ComfyPort" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            $ready = $true
            break
        } catch { }
    }
    $comfyOutR.Close(); $comfyErrR.Close()
    if ($ready) { lok "comfyui" "ready  ->  http://localhost:$ComfyPort" }
    else        { lwarn "comfyui" "timeout - continuing anyway" }
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

$pair       = New-LogPair
$outFile    = $pair[0]
$errFile    = $pair[1]
Start-Sleep -Seconds 1
$workerProc = Start-Worker $outFile $errFile
Start-Sleep -Milliseconds 500
$outReader  = Open-LogReader $outFile
$errReader  = Open-LogReader $errFile
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
            lerr "worker" "exited (code=$($workerProc.ExitCode)) -- restarting in 5s..."
            Start-Sleep -Seconds 5
            $outReader.Close(); $errReader.Close()
            Clear-Port
            $pair2      = New-LogPair
            $outFile    = $pair2[0]
            $errFile    = $pair2[1]
            $workerProc = Start-Worker $outFile $errFile
            Start-Sleep -Milliseconds 500
            $outReader  = Open-LogReader $outFile
            $errReader  = Open-LogReader $errFile
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
                    lwarn "tunnel" "dropped -- rebuilding..."
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
        Stop-Tree $workerProc.Id
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
