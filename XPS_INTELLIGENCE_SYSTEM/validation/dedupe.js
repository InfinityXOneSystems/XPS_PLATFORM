const MIN_PHONE_DIGITS = 7;

/**
 * Normalizes a company name for comparison (lowercase, alphanumeric only).
 * @param {string} name
 * @returns {string}
 */
function normalizeCompany(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalizes a phone number to digits only.
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Normalizes a website URL to a bare domain/path key.
 * Strips protocol, leading "www.", and trailing slashes.
 * @param {string} url
 * @returns {string}
 */
function normalizeWebsite(url) {
  return (url || "")
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .trim();
}

/**
 * Removes duplicate leads from an array.
 * Deduplication keys: normalized company+city, phone digits, email, and website.
 * @param {Object[]} leads
 * @returns {{ unique: Object[], duplicates: Object[] }}
 */
function dedupe(leads) {
  const seenCompanyCity = new Set();
  const seenPhone = new Set();
  const seenEmail = new Set();
  const seenWebsite = new Set();
  const unique = [];
  const duplicates = [];

  for (const lead of leads) {
    const companyKey =
      normalizeCompany(lead.company) +
      "|" +
      (lead.city || "").toLowerCase().trim();
    const phoneKey = normalizePhone(lead.phone);
    const emailKey = (lead.email || "").toLowerCase().trim();
    const websiteKey = normalizeWebsite(lead.website);

    const isDupe =
      seenCompanyCity.has(companyKey) ||
      (phoneKey.length >= MIN_PHONE_DIGITS && seenPhone.has(phoneKey)) ||
      (emailKey.length > 0 && seenEmail.has(emailKey)) ||
      (websiteKey.length > 0 && seenWebsite.has(websiteKey));

    if (isDupe) {
      duplicates.push(lead);
    } else {
      seenCompanyCity.add(companyKey);
      if (phoneKey.length >= MIN_PHONE_DIGITS) seenPhone.add(phoneKey);
      if (emailKey.length > 0) seenEmail.add(emailKey);
      if (websiteKey.length > 0) seenWebsite.add(websiteKey);
      unique.push(lead);
    }
  }

  return { unique, duplicates };
}

module.exports = { dedupe, normalizeWebsite };
