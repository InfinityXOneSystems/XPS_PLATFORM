const { PlaywrightCrawler } = require("crawlee");
const db = require("../../database/database");
const scoreLead = require("../../agents/scoring/score_engine");

const crawler = new PlaywrightCrawler({
  async requestHandler({ page, request }) {
    const query = request.url;

    console.log("Scraping:", query);

    await page.goto(query);

    await page.waitForTimeout(5000);

    const leads = await page.evaluate(() => {
      let data = [];

      document.querySelectorAll("div.Nv2PK").forEach((card) => {
        let name = card.innerText;

        data.push({ company: name });
      });

      return data;
    });

    leads.forEach((l) => {
      let score = scoreLead(l);

      db.prepare("INSERT INTO leads(company,score) VALUES (?,?)").run(
        l.company,
        score,
      );
    });
  },
});

async function run() {
  const queries = require("../../data/national/search_queries.json");

  const urls = queries.map(
    (q) => "https://www.google.com/maps/search/" + encodeURIComponent(q),
  );

  await crawler.run(urls);
}

run();
