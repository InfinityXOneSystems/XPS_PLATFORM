import os, json, requests, time

BASE = os.path.dirname(__file__)

def load_env():
    env={}
    with open(os.path.join(BASE,'.env')) as f:
        for line in f:
            if '=' in line:
                k,v=line.strip().split('=',1)
                env[k]=v
    return env

ENV = load_env()

HEADERS={
 'Authorization': f"token {ENV['GITHUB_TOKEN']}",
 'Accept':'application/vnd.github+json'
}

def dispatch(repo,event,payload=None):
    url=f"https://api.github.com/repos/{repo}/dispatches"
    body={"event_type":event,"client_payload":payload or {}}
    r=requests.post(url,json=body,headers=HEADERS)
    print(f"{repo} -> {r.status_code}")

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(path,data):
    with open(path,'w') as f:
        json.dump(data,f,indent=2)

def run_jobs():
    jobs = load_json(os.path.join(BASE,"jobs","queue.json"))
    state = load_json(os.path.join(BASE,"state","state.json"))

    for job in jobs:
        try:
            dispatch(job["repo"],job["type"],job)
            state["repos"][job["repo"]] = "ok"
        except Exception as e:
            state["failures"].append(str(e))

    state["last_run"]=time.time()
    save_json(os.path.join(BASE,"state","state.json"),state)

def loop():
    while True:
        print("XPS ORCHESTRATOR RUN")
        run_jobs()
        time.sleep(60)

if __name__=="__main__":
    loop()
