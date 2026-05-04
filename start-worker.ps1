# start-worker.ps1 — Start SSH reverse tunnel + local image worker
# Run from D:\SD\siyuwanban\
#
# Usage:
#   .\start-worker.ps1
#   .\start-worker.ps1 -NoTunnel   (if tunnel is already running)

param([switch]$NoTunnel)

$Server = "root@168.144.108.9"
$WorkerPort = 7080   # worker API — all image generation goes through here

Write-Host "[worker] Starting local image generation worker..." -ForegroundColor Cyan

if (-not $NoTunnel) {
    Write-Host "[tunnel] Opening SSH reverse tunnel: remote:$WorkerPort -> local:$WorkerPort" -ForegroundColor Yellow
    # Single tunnel for the worker (handles both album and scene generation)
    $tunnel = Start-Process -FilePath "ssh" `
        -ArgumentList "-N", "-R", "${WorkerPort}:localhost:${WorkerPort}",
            "-o", "ServerAliveInterval=20",
            "-o", "ServerAliveCountMax=10",
            "-o", "ExitOnForwardFailure=yes",
            $Server `
        -PassThru -WindowStyle Hidden
    Write-Host "[tunnel] PID $($tunnel.Id) — tunnel open. Server now routes localhost:$WorkerPort to this machine." -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Install deps if needed
if (-not (Test-Path "image-worker\node_modules")) {
    Write-Host "[worker] Installing dependencies..." -ForegroundColor Yellow
    Push-Location image-worker
    npm install
    Pop-Location
}

# Copy .env if missing
if (-not (Test-Path "image-worker\.env")) {
    if (Test-Path "image-worker\.env.example") {
        Copy-Item "image-worker\.env.example" "image-worker\.env"
        Write-Host "[worker] Created image-worker\.env from example. Edit WORKER_KEY and ADMIN_KEY if needed." -ForegroundColor Yellow
    }
}

Write-Host "[worker] Starting server on port $WorkerPort..." -ForegroundColor Cyan
Push-Location image-worker
npm start
Pop-Location

if (-not $NoTunnel -and $tunnel -and -not $tunnel.HasExited) {
    Write-Host "[tunnel] Stopping SSH tunnel (PID $($tunnel.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $tunnel.Id -Force
}
