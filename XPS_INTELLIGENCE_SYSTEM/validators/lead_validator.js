const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\+]?[\d\s\-\(\)\.]{7,15}$/;
const URL_REGEX = /^https?:\/\/.+\..+/i;

/**
 * Validates a single lead object.
 * @param {Object} lead
 * @returns {{ valid: boolean, errors: string[], warnings: string[], score: number }}
 */
function validateLead(lead) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!lead.company) {
    errors.push("Missing required field: company");
  }

  if (!lead.city) {
    warnings.push("Missing field: city");
  }

  // Email format
  if (lead.email) {
    if (!EMAIL_REGEX.test(lead.email)) {
      errors.push("Invalid email format: " + lead.email);
    }
  }

  // Phone format
  if (lead.phone) {
    if (!PHONE_REGEX.test(lead.phone)) {
      warnings.push("Invalid phone format: " + lead.phone);
    }
  }

  // Website URL format
  if (lead.website) {
    if (!URL_REGEX.test(lead.website)) {
      warnings.push("Invalid website format: " + lead.website);
    }
  }

  // Rating range (0–5)
  if (lead.rating !== undefined && lead.rating !== null) {
    if (typeof lead.rating !== "number") {
      warnings.push("Rating must be a number: " + lead.rating);
    } else if (lead.rating < 0 || lead.rating > 5) {
      warnings.push("Rating out of valid range (0–5): " + lead.rating);
    }
  }

  // Reviews non-negative
  if (lead.reviews !== undefined && lead.reviews !== null) {
    if (typeof lead.reviews !== "number") {
      warnings.push("Reviews must be a number: " + lead.reviews);
    } else if (lead.reviews < 0) {
      warnings.push("Invalid reviews count: " + lead.reviews);
    }
  }

  // Data quality score (0–100)
  let score = 0;
  if (lead.company) score += 20;
  if (lead.phone) score += 20;
  if (lead.email) score += 20;
  if (lead.website) score += 20;
  if (lead.city) score += 10;
  if (typeof lead.rating === "number" && lead.rating >= 4) score += 5;
  if (typeof lead.reviews === "number" && lead.reviews > 10) score += 5;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score,
  };
}

module.exports = { validateLead };
