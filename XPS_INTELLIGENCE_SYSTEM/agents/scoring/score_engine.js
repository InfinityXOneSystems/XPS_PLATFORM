function scoreLead(lead) {
  let score = 0;

  if (lead.website) score += 10;
  if (lead.phone) score += 10;
  if (lead.email) score += 15;
  if (lead.reviews > 10) score += 5;
  if (lead.rating > 4) score += 10;

  return score;
}

module.exports = scoreLead;
