"use strict";

class AsyncScrapingEngine {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.queue = [];
  }

  addTask(fn) {
    this.queue.push(fn);
  }

  async runAll() {
    const tasks = [...this.queue];
    this.queue = [];
    return AsyncScrapingEngine.runBatch(tasks, this.concurrency);
  }

  static async runBatch(tasks, concurrency = 5) {
    const results = new Array(tasks.length);
    let index = 0;
    let active = 0;

    return new Promise((resolve, reject) => {
      function next() {
        while (active < concurrency && index < tasks.length) {
          const taskIndex = index++;
          active++;
          Promise.resolve()
            .then(() => tasks[taskIndex]())
            .then((result) => {
              results[taskIndex] = { status: "fulfilled", value: result };
            })
            .catch((err) => {
              results[taskIndex] = { status: "rejected", reason: err };
            })
            .finally(() => {
              active--;
              if (index < tasks.length) {
                next();
              } else if (active === 0) {
                resolve(results);
              }
            });
        }
        if (tasks.length === 0) resolve(results);
      }
      next();
    });
  }
}

module.exports = AsyncScrapingEngine;
