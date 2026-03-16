"use strict";

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.resolve(__dirname, "leads.db");
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT,
  phone   TEXT,
  website TEXT,
  rating  REAL,
  reviews INTEGER,
  address TEXT,
  city    TEXT,
  state   TEXT,
  email   TEXT,
  score   INTEGER
)
`);

module.exports = db;
