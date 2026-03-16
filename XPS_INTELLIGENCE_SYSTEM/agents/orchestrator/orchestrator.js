"use strict";

const fs = require("fs");
const path = require("path");
const { runPipeline } = require("../scoring/scoring_pipeline");

const ROOT = path.resolve(__dirname, "..", "..");

function orchestrate() {
  console.log("[orchestrator] Reading roadmap...");
  const roadmap = fs.readFileSync(path.join(ROOT, "ROADMAP.md")).toString();
  console.log("[orchestrator] Roadmap loaded.");

  console.log("[orchestrator] Reading TODO...");
  const todo = fs.readFileSync(path.join(ROOT, "todo", "todo.csv")).toString();
  console.log("[orchestrator] TODO loaded.");

  console.log("[orchestrator] Running lead scoring pipeline...");
  const { scored, report } = runPipeline();

  console.log(
    `[orchestrator] Scoring complete. ${scored.length} leads scored.`,
  );
  console.log(
    `[orchestrator] HOT: ${report.tiers.HOT}  WARM: ${report.tiers.WARM}  COLD: ${report.tiers.COLD}`,
  );
}

orchestrate();
