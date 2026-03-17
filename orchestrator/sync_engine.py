import os,requests,time,subprocess

GITHUB_TOKEN=os.getenv("GITHUB_TOKEN")
SUPABASE_URL=os.getenv("SUPABASE_URL")
SUPABASE_KEY=os.getenv("SUPABASE_KEY")

def git_pull():
    subprocess.run("git pull origin main",shell=True)

def git_push():
    subprocess.run("git add .",shell=True)
    subprocess.run("git commit -m sync || exit 0",shell=True)
    subprocess.run("git push origin main",shell=True)

def supabase_sync():
    url=f"{SUPABASE_URL}/rest/v1/system_logs"
    headers={
        "apikey":SUPABASE_KEY,
        "Authorization":f"Bearer {SUPABASE_KEY}"
    }
    requests.post(url,json={"event":"sync"},headers=headers)

def loop():
    while True:
        print("SYNC LOOP RUNNING")
        git_pull()
        git_push()
        supabase_sync()
        time.sleep(60)

loop()
