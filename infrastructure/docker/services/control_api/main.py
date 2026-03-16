from fastapi import FastAPI
import subprocess
import sys

sys.path.append("C:/XPS_PLATFORM/services")

from lead_router.lead_router import store_lead

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

    return {"agent":agent,"status":"started"}
