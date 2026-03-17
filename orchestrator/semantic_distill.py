import os,json

ROOT="C:/XPS_PLATFORM"
OUT="C:/XPS_PLATFORM/_SYSTEM/semantic.json"

def extract():
    data=[]
    for root,_,files in os.walk(ROOT):
        for f in files:
            if f.endswith((".py",".ts",".js",".json",".yml")):
                path=os.path.join(root,f)
                try:
                    with open(path,'r',encoding='utf-8',errors='ignore') as file:
                        content=file.read()[:2000]
                        data.append({
                            "file":path,
                            "content":content
                        })
                except:
                    pass
    return data

with open(OUT,"w") as f:
    json.dump(extract(),f,indent=2)
