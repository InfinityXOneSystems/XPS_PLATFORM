import os,json,hashlib

ROOT="C:/XPS_PLATFORM"
OUTPUT="C:/XPS_PLATFORM/_SYSTEM/distilled.json"

def file_hash(path):
    with open(path,'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def scan():
    system={}
    for root,dirs,files in os.walk(ROOT):
        system[root]=[]
        for f in files:
            p=os.path.join(root,f)
            try:
                system[root].append({
                    "file":f,
                    "hash":file_hash(p)
                })
            except:
                pass
    return system

def distill():
    data=scan()
    with open(OUTPUT,"w") as f:
        json.dump(data,f,indent=2)

distill()
