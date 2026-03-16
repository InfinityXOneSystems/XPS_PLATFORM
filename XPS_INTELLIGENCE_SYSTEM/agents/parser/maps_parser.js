function parseCard(card) {
  let lead = {};

  lead.company = card.querySelector(".qBF1Pd")?.innerText || "";

  lead.rating = card.querySelector(".MW4etd")?.innerText || "";

  lead.reviews = card.querySelector(".UY7F9")?.innerText || "";

  lead.address = card.innerText || "";

  return lead;
}

module.exports = parseCard;
