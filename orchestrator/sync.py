import os,subprocess,time,requests

SUPABASE=os.getenv("SUPABASE_URL")
KEY=os.getenv("SUPABASE_KEY")

def git_sync():
    subprocess.run("git pull origin main",shell=True)
    subprocess.run("git add .",shell=True)
    subprocess.run("git commit -m sync || exit 0",shell=True)
    subprocess.run("git push origin main",shell=True)

def supabase_sync():
    if SUPABASE:
        requests.post(f"{SUPABASE}/rest/v1/logs",json={"sync":True},
        headers={"apikey":KEY,"Authorization":f"Bearer {KEY}"})

while True:
    git_sync()
    supabase_sync()
    time.sleep(60)
