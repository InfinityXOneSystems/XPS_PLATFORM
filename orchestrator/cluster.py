import multiprocessing, time

def worker(id):
    while True:
        print(f"WORKER {id} ACTIVE")
        time.sleep(5)

if __name__ == "__main__":
    for i in range(4):
        multiprocessing.Process(target=worker,args=(i,)).start()

    while True:
        time.sleep(60)
