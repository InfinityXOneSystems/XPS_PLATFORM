"use strict";

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "../../data/logs/system.log");

const COLORS = {
  reset: "\x1b[0m",
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  debug: "\x1b[90m", // grey
};

let _logStream = null;

function getLogStream() {
  if (_logStream) return _logStream;
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  return _logStream;
}

class SystemLogger {
  constructor(name = "system") {
    this.name = name;
  }

  _log(level, msg, meta = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      logger: this.name,
      msg,
      ...meta,
    };

    // Fallback to console.error on file write failures (disk full, permissions, etc.)
    try {
      getLogStream().write(JSON.stringify(entry) + "\n");
    } catch (err) {
      console.error(
        `[SystemLogger] Failed to write to log file: ${err.message}`,
      );
    }

    // Colorized console output
    const color = COLORS[level] || COLORS.reset;
    const prefix = `${color}[${level.toUpperCase()}]${COLORS.reset} [${this.name}]`;
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    console.log(`${entry.ts} ${prefix} ${msg}${metaStr}`);
  }

  info(msg, meta) {
    this._log("info", msg, meta);
  }
  warn(msg, meta) {
    this._log("warn", msg, meta);
  }
  error(msg, meta) {
    this._log("error", msg, meta);
  }
  debug(msg, meta) {
    this._log("debug", msg, meta);
  }

  static getLogger(name) {
    return new SystemLogger(name);
  }
}

module.exports = SystemLogger;
