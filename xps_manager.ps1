# ==========================================
# XPS PLATFORM MASTER CONTROL SCRIPT
# ==========================================

$ROOT="C:\XPS_PLATFORM"
$BACKEND="$ROOT\XPS_INTELLIGENCE_SYSTEM"
$FRONTEND="$ROOT\XPS-INTELLIGENCE-FRONTEND"
$LEADS="$ROOT\LEADS"
$RUNNER="C:\actions-runner"
$CONTROL="$ROOT\services\control_api"

function status {

    Clear-Host

    Write-Host "================================="
    Write-Host "XPS PLATFORM STATUS"
    Write-Host "================================="

    Write-Host ""
    Write-Host "RUNNER STATUS"
    Get-Service actions.runner*

    Write-Host ""
    Write-Host "DOCKER CONTAINERS"
    docker ps

    Write-Host ""
    Write-Host "PYTHON"
    python --version

    Write-Host ""
    Write-Host "NODE"
    node --version

    Write-Host ""
    Write-Host "BACKEND REPO"
    cd $BACKEND
    git status

    Write-Host ""
    Write-Host "FRONTEND REPO"
    cd $FRONTEND
    git status

    Write-Host ""
    Write-Host "LEADS REPO"
    cd $LEADS
    git status

}

function start_api {

    Write-Host "Starting Control Plane API..."

    Start-Process powershell -ArgumentList "
        cd $CONTROL
        uvicorn control_api:app --host 0.0.0.0 --port 8000
    "

}

function docker_start {

    Write-Host "Starting Docker stack..."

    cd $ROOT\infrastructure\docker

    docker compose up -d

}

function docker_stop {

    Write-Host "Stopping Docker stack..."

    cd $ROOT\infrastructure\docker

    docker compose down

}

function sync_repos {

    Write-Host "Syncing repositories..."

    cd $BACKEND
    git pull

    cd $FRONTEND
    git pull

    cd $LEADS
    git pull

}

function push_repos {

    Write-Host "Pushing repositories..."

    cd $BACKEND
    git push

    cd $FRONTEND
    git push

    cd $LEADS
    git push

}

function run_agent {

    param($agent)

    Write-Host "Running agent $agent"

    cd $BACKEND

    python agents\$agent

}

function run_scraper {

    Write-Host "Running shadow scraper..."

    cd $BACKEND

    python vision_cortex\shadow_scraper\shadow_scraper.py

}

function run_vision {

    Write-Host "Running Vision Cortex..."

    cd $BACKEND

    python vision_cortex\intelligence_processor.py

}

function monitor {

    while ($true) {

        Clear-Host

        Write-Host "=========================="
        Write-Host "XPS LIVE MONITOR"
        Write-Host "=========================="

        docker ps

        Write-Host ""
        Get-Service actions.runner*

        Write-Host ""
        Get-Process python -ErrorAction SilentlyContinue

        Write-Host ""
        Get-Process node -ErrorAction SilentlyContinue

        Start-Sleep 5
    }

}

function menu {

    while ($true) {

        Write-Host ""
        Write-Host "=============================="
        Write-Host "XPS PLATFORM CONTROL PANEL"
        Write-Host "=============================="
        Write-Host ""
        Write-Host "1 - System Status"
        Write-Host "2 - Start Control API"
        Write-Host "3 - Start Docker"
        Write-Host "4 - Stop Docker"
        Write-Host "5 - Sync Repos"
        Write-Host "6 - Push Repos"
        Write-Host "7 - Run Vision Cortex"
        Write-Host "8 - Run Scraper"
        Write-Host "9 - Monitor System"
        Write-Host "0 - Exit"
        Write-Host ""

        $choice = Read-Host "Select option"

        switch ($choice) {

            "1" { status }
            "2" { start_api }
            "3" { docker_start }
            "4" { docker_stop }
            "5" { sync_repos }
            "6" { push_repos }
            "7" { run_vision }
            "8" { run_scraper }
            "9" { monitor }
            "0" { exit }

        }

    }

}

menu