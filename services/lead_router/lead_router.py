import os
import json
from supabase import create_client

SUPABASE_URL=os.getenv("SUPABASE_URL")
SUPABASE_KEY=os.getenv("SUPABASE_KEY")

supabase=create_client(SUPABASE_URL,SUPABASE_KEY)

LEADS_PATH="C:/XPS_PLATFORM/LEADS/data"

os.makedirs(LEADS_PATH,exist_ok=True)

def store_lead(lead):

    try:

        supabase.table("leads").insert(lead).execute()

    except Exception as e:

        print("Supabase error:",e)

    filename=lead.get("company","lead")+".json"

    with open(f"{LEADS_PATH}/{filename}","w") as f:

        json.dump(lead,f,indent=2)

    print("Lead stored:",filename)
