import subprocess
import os

LEADS_REPO="C:/XPS_PLATFORM/LEADS"

def commit_leads():

    os.chdir(LEADS_REPO)

    subprocess.call(["git","add","."])

    subprocess.call(["git","commit","-m","auto leads update"])

    subprocess.call(["git","push"])

if __name__=="__main__":

    commit_leads()
