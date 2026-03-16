# ==========================================================
# XPS AI OPERATING SYSTEM INSTALLER
# ==========================================================

$ROOT="C:\XPS_PLATFORM"

Write-Host ""
Write-Host "===================================="
Write-Host "XPS AUTONOMOUS PLATFORM INSTALLING"
Write-Host "===================================="

# ----------------------------------------------------------
# CREATE DIRECTORIES
# ----------------------------------------------------------

$dirs=@(
"$ROOT\data",
"$ROOT\logs",

"$ROOT\services",
"$ROOT\services\control_plane",
"$ROOT\services\lead_router",
"$ROOT\services\repo_commit",
"$ROOT\services\agent_orchestrator",
"$ROOT\services\mcp_gateway",

"$ROOT\ai",
"$ROOT\ai\vision_cortex",
"$ROOT\ai\lead_scoring",
"$ROOT\ai\repo_healer",
"$ROOT\ai\system_monitor",
"$ROOT\ai\copilot_orchestrator"
)

foreach($d in $dirs){
if(!(Test-Path $d)){ mkdir $d | Out-Null }
}

Write-Host "Directories ready."

# ----------------------------------------------------------
# INSTALL PYTHON DEPENDENCIES
# ----------------------------------------------------------

Write-Host "Installing dependencies..."

pip install fastapi uvicorn psutil gitpython requests numpy pandas scikit-learn docker

# ----------------------------------------------------------
# LEAD ROUTER
# ----------------------------------------------------------

$lead=@"
import os,json
DATA="C:/XPS_PLATFORM/LEADS/data"
os.makedirs(DATA,exist_ok=True)

def store_lead(lead):
    name=lead.get("company","lead").replace(" ","_")+".json"
    path=DATA+"/"+name
    with open(path,"w") as f:
        json.dump(lead,f,indent=2)
    print("Stored:",name)
"@

$lead | Out-File "$ROOT/services/lead_router/router.py"

# ----------------------------------------------------------
# CONTROL API
# ----------------------------------------------------------

$api=@"
from fastapi import FastAPI
import subprocess,sys

sys.path.append("C:/XPS_PLATFORM/services")

from lead_router.router import store_lead

app=FastAPI()

@app.get("/system/status")
def status():
    return {"status":"XPS platform running"}

@app.post("/lead/store")
def store(lead:dict):
    store_lead(lead)
    return {"status":"stored"}

@app.post("/agent/run")
def run(agent:str):
    subprocess.Popen(["python",agent])
    return {"agent":agent}
"@

$api | Out-File "$ROOT/services/control_plane/main.py"

# ----------------------------------------------------------
# AGENT ORCHESTRATOR
# ----------------------------------------------------------

$agent=@"
import subprocess,time

agents=[
"C:/XPS_PLATFORM/scripts/scraper.py",
"C:/XPS_PLATFORM/scripts/vision_cortex.py"
]

while True:

    for a in agents:

        try:
            subprocess.Popen(["python",a])
        except:
            pass

    time.sleep(300)
"@

$agent | Out-File "$ROOT/services/agent_orchestrator/orchestrator.py"

# ----------------------------------------------------------
# REPO HEALER
# ----------------------------------------------------------

$heal=@"
import subprocess

repos=[
"C:/XPS_PLATFORM/XPS_INTELLIGENCE_SYSTEM",
"C:/XPS_PLATFORM/XPS-INTELLIGENCE-FRONTEND",
"C:/XPS_PLATFORM/LEADS"
]

for r in repos:

    try:
        subprocess.call(["git","-C",r,"fetch"])
        subprocess.call(["git","-C",r,"pull"])
        print("Repo healthy:",r)
    except:
        print("Repo issue:",r)
"@

$heal | Out-File "$ROOT/ai/repo_healer/heal.py"

# ----------------------------------------------------------
# VISION CORTEX
# ----------------------------------------------------------

$vision=@"
import os,json

DATA="C:/XPS_PLATFORM/LEADS/data"

if os.path.exists(DATA):

    leads=[f for f in os.listdir(DATA) if f.endswith(".json")]

    print("Total leads:",len(leads))
"@

$vision | Out-File "$ROOT/ai/vision_cortex/vision.py"

# ----------------------------------------------------------
# LEAD SCORING
# ----------------------------------------------------------

$score=@"
import json,os

DATA="C:/XPS_PLATFORM/LEADS/data"

def score(l):

    s=0

    if l.get("phone"): s+=30
    if l.get("website"): s+=30
    if l.get("industry"): s+=20

    return s

for f in os.listdir(DATA):

    if f.endswith(".json"):

        path=DATA+"/"+f

        with open(path) as file:
            lead=json.load(file)

        lead["score"]=score(lead)

        with open(path,"w") as file:
            json.dump(lead,file,indent=2)

        print("Scored:",f)
"@

$score | Out-File "$ROOT/ai/lead_scoring/score.py"

# ----------------------------------------------------------
# SYSTEM MONITOR
# ----------------------------------------------------------

$monitor=@"
import psutil,time

while True:

    print("CPU:",psutil.cpu_percent())
    print("RAM:",psutil.virtual_memory().percent)

    time.sleep(30)
"@

$monitor | Out-File "$ROOT/ai/system_monitor/monitor.py"

# ----------------------------------------------------------
# COPILOT ORCHESTRATOR
# ----------------------------------------------------------

$copilot=@"
import subprocess,time

while True:

    subprocess.call(["git","-C","C:/XPS_PLATFORM/XPS_INTELLIGENCE_SYSTEM","pull"])

    print("Repo sync complete")

    time.sleep(300)
"@

$copilot | Out-File "$ROOT/ai/copilot_orchestrator/orchestrator.py"

# ----------------------------------------------------------
# START SERVICES
# ----------------------------------------------------------

Write-Host "Starting Control API..."

Start-Process powershell -NoExit -ArgumentList "
cd $ROOT/services/control_plane
python -m uvicorn main:app --host 0.0.0.0 --port 8000
"

Start-Process powershell -NoExit -ArgumentList "
python $ROOT/services/agent_orchestrator/orchestrator.py
"

Start-Process powershell -NoExit -ArgumentList "
python $ROOT/ai/repo_healer/heal.py
"

Start-Process powershell -NoExit -ArgumentList "
python $ROOT/ai/vision_cortex/vision.py
"

Start-Process powershell -NoExit -ArgumentList "
python $ROOT/ai/lead_scoring/score.py
"

Start-Process powershell -NoExit -ArgumentList "
python $ROOT/ai/system_monitor/monitor.py
"

Start-Process powershell -NoExit -ArgumentList "
python $ROOT/ai/copilot_orchestrator/orchestrator.py
"

Write-Host ""
Write-Host "===================================="
Write-Host "XPS AI OPERATING SYSTEM ACTIVE"
Write-Host "===================================="

Write-Host ""
Write-Host "Control API:"
Write-Host "http://localhost:8000/system/status"

Write-Host ""
Write-Host "Lead API:"
Write-Host "POST http://localhost:8000/lead/store"
