import requests, sys

ENV_PATH = r'C:\XPS_PLATFORM\orchestrator\.env'

def load_token():
    with open(ENV_PATH) as f:
        for line in f:
            if line.startswith('GITHUB_TOKEN='):
                return line.split('=',1)[1].strip()
    return None

token = load_token()

if not token:
    print("ERROR: TOKEN MISSING")
    sys.exit(1)

headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github+json"
}

# TEST 1: USER AUTH
r1 = requests.get("https://api.github.com/user", headers=headers)
print("USER STATUS:", r1.status_code)

# TEST 2: REPO ACCESS
r2 = requests.get("https://api.github.com/repos/InfinityXOneSystems/XPS_PLATFORM", headers=headers)
print("REPO STATUS:", r2.status_code)

# TEST 3: DISPATCH
r3 = requests.post(
    "https://api.github.com/repos/InfinityXOneSystems/XPS_PLATFORM/dispatches",
    json={"event_type":"test"},
    headers=headers
)

print("DISPATCH STATUS:", r3.status_code)
print("DISPATCH RESPONSE:", r3.text)

if r3.status_code == 204:
    print("SUCCESS: ORCHESTRATOR READY")
else:
    print("FAIL: CHECK TOKEN PERMISSIONS")
