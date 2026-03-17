import os,json

ROOT=r'C:/XPS_PLATFORM'
OUT=r'C:/XPS_PLATFORM/_SYSTEM/distilled.json'

data=[]

for root,_,files in os.walk(ROOT):
    for f in files:
        if f.endswith(('.py','.js','.ts','.json','.yml')):
            try:
                p=os.path.join(root,f)
                c=open(p,'r',encoding='utf-8',errors='ignore').read()[:2000]
                data.append({"file":p,"content":c})
            except: pass

json.dump(data,open(OUT,'w'),indent=2)
