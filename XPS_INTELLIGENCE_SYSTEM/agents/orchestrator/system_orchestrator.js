const fs = require("fs");

function run() {
  console.log("READING ROADMAP");
  const roadmap = fs.readFileSync("ROADMAP.md").toString();

  console.log("READING TASKS");
  const todo = fs.readFileSync("todo/todo.csv").toString();

  console.log("SYSTEM READY");
}

run();
