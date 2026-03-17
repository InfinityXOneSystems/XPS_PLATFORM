import redis,json
r=redis.Redis(host='localhost',port=6379)

def publish(c,d):
    r.publish(c,json.dumps(d))
