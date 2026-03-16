"use strict";

/**
 * lead_contract_validator.js
 *
 * Validates a lead object against the universal lead contract defined in
 * contracts/lead_schema.json.
 *
 * Uses a lightweight, dependency-free JSON Schema (draft-07) validator that
 * handles the subset of keywords used in lead_schema.json:
 *   type, required, properties, minLength, minimum, maximum, pattern,
 *   format (email, uri), enum, additionalProperties.
 *
 * Returns:
 *   { valid: boolean, errors: string[] }
 */

const schema = require("../contracts/lead_schema.json");

// ── Regex helpers ────────────────────────────────────────────────────────────

const FORMAT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uri: /^https?:\/\/.+\..+/i,
};

// ── Core validator ───────────────────────────────────────────────────────────

/**
 * Validates `value` against a property `subSchema` and pushes any
 * human-readable error messages onto the `errors` array.
 *
 * @param {string}   fieldPath  Dot-separated path for error messages.
 * @param {*}        value
 * @param {object}   subSchema  Property schema extracted from lead_schema.json.
 * @param {string[]} errors     Accumulator for error messages.
 */
function validateProperty(fieldPath, value, subSchema, errors) {
  // ── type ──────────────────────────────────────────────────────────────────
  if (subSchema.type !== undefined) {
    const types = Array.isArray(subSchema.type)
      ? subSchema.type
      : [subSchema.type];
    const jsType = typeof value;
    const typeOk = types.some((t) => {
      if (t === "integer") return Number.isInteger(value);
      if (t === "number") return jsType === "number" && !isNaN(value);
      if (t === "string") return jsType === "string";
      if (t === "boolean") return jsType === "boolean";
      if (t === "object")
        return jsType === "object" && value !== null && !Array.isArray(value);
      if (t === "array") return Array.isArray(value);
      if (t === "null") return value === null;
      return false;
    });
    if (!typeOk) {
      errors.push(
        `'${fieldPath}' must be of type ${types.join(" | ")}, got ${jsType}`,
      );
      return; // subsequent checks would be meaningless
    }
  }

  // ── minLength ─────────────────────────────────────────────────────────────
  if (subSchema.minLength !== undefined && typeof value === "string") {
    if (value.length < subSchema.minLength) {
      errors.push(
        `'${fieldPath}' must have a minimum length of ${subSchema.minLength}`,
      );
    }
  }

  // ── minimum / maximum ─────────────────────────────────────────────────────
  if (subSchema.minimum !== undefined && typeof value === "number") {
    if (value < subSchema.minimum) {
      errors.push(
        `'${fieldPath}' must be >= ${subSchema.minimum}, got ${value}`,
      );
    }
  }
  if (subSchema.maximum !== undefined && typeof value === "number") {
    if (value > subSchema.maximum) {
      errors.push(
        `'${fieldPath}' must be <= ${subSchema.maximum}, got ${value}`,
      );
    }
  }

  // ── pattern ───────────────────────────────────────────────────────────────
  if (subSchema.pattern !== undefined && typeof value === "string") {
    const re = new RegExp(subSchema.pattern);
    if (!re.test(value)) {
      errors.push(`'${fieldPath}' does not match required pattern`);
    }
  }

  // ── format ────────────────────────────────────────────────────────────────
  if (subSchema.format !== undefined && typeof value === "string") {
    const re = FORMAT_PATTERNS[subSchema.format];
    if (re && !re.test(value)) {
      errors.push(
        `'${fieldPath}' is not a valid ${subSchema.format}: "${value}"`,
      );
    }
  }

  // ── enum ──────────────────────────────────────────────────────────────────
  if (subSchema.enum !== undefined) {
    if (!subSchema.enum.includes(value)) {
      errors.push(
        `'${fieldPath}' must be one of [${subSchema.enum.join(", ")}], got "${value}"`,
      );
    }
  }

  // ── nested object properties ──────────────────────────────────────────────
  if (
    subSchema.properties !== undefined &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const required = subSchema.required || [];
    for (const req of required) {
      if (!(req in value)) {
        errors.push(`'${fieldPath}.${req}' is required`);
      }
    }
    for (const [k, propSchema] of Object.entries(subSchema.properties)) {
      if (k in value && value[k] !== undefined && value[k] !== null) {
        validateProperty(`${fieldPath}.${k}`, value[k], propSchema, errors);
      }
    }
    if (subSchema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in subSchema.properties)) {
          errors.push(
            `'${fieldPath}' has unexpected additional property: '${k}'`,
          );
        }
      }
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a single lead object against contracts/lead_schema.json.
 *
 * @param {object} lead
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLeadContract(lead) {
  const errors = [];

  if (typeof lead !== "object" || lead === null || Array.isArray(lead)) {
    return { valid: false, errors: ["Lead must be a non-null object"] };
  }

  // ── required fields ───────────────────────────────────────────────────────
  for (const field of schema.required || []) {
    if (!(field in lead) || lead[field] === undefined || lead[field] === null) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // ── per-property validation ───────────────────────────────────────────────
  for (const [key, propSchema] of Object.entries(schema.properties || {})) {
    const value = lead[key];
    // Only validate fields that are present and non-null
    if (value !== undefined && value !== null) {
      validateProperty(key, value, propSchema, errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateLeadContract };
