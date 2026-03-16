const fs = require("fs");

function loadTasks() {
  const tasks = fs.readFileSync("todo/todo.csv");
  console.log(tasks);
}

loadTasks();
