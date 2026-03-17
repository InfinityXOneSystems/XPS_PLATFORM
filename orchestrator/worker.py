import time
from event_bus import publish

while True:
    publish("jobs",{"status":"running"})
    time.sleep(5)
