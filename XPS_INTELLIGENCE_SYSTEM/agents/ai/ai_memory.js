"use strict";

const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "../../data/ai/memory.json");

const VALID_CATEGORIES = [
  "lead_context",
  "preference",
  "conversation",
  "system",
];

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveMemory(data) {
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

class AIMemoryLayer {
  constructor() {
    this._memory = loadMemory();
  }

  store(key, value, category = "system") {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(
        `Invalid category "${category}". Valid: ${VALID_CATEGORIES.join(", ")}`,
      );
    }
    this._memory[key] = {
      value,
      category,
      stored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this._persist();
    return { key, category, stored: true };
  }

  retrieve(key) {
    const entry = this._memory[key];
    if (!entry) return null;
    return { key, ...entry };
  }

  search(query) {
    if (!query || typeof query !== "string") return [];
    const lower = query.toLowerCase();
    const results = [];

    for (const [key, entry] of Object.entries(this._memory)) {
      const valueStr =
        typeof entry.value === "string"
          ? entry.value
          : JSON.stringify(entry.value);

      if (
        key.toLowerCase().includes(lower) ||
        valueStr.toLowerCase().includes(lower) ||
        entry.category.toLowerCase().includes(lower)
      ) {
        results.push({ key, ...entry });
      }
    }

    return results;
  }

  getByCategory(category) {
    return Object.entries(this._memory)
      .filter(([, entry]) => entry.category === category)
      .map(([key, entry]) => ({ key, ...entry }));
  }

  forget(key) {
    if (!this._memory[key]) return { forgotten: false, key };
    delete this._memory[key];
    this._persist();
    return { forgotten: true, key };
  }

  forgetCategory(category) {
    const removed = [];
    for (const key of Object.keys(this._memory)) {
      if (this._memory[key].category === category) {
        removed.push(key);
        delete this._memory[key];
      }
    }
    this._persist();
    return { forgotten: removed.length, keys: removed };
  }

  listAll() {
    return Object.entries(this._memory).map(([key, entry]) => ({
      key,
      ...entry,
    }));
  }

  _persist() {
    try {
      saveMemory(this._memory);
    } catch (err) {
      console.error("[AIMemoryLayer] Failed to persist memory:", err.message);
    }
  }
}

module.exports = AIMemoryLayer;
