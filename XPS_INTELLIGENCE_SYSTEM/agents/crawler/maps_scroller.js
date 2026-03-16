async function scrollResults(page) {
  const panel = 'div[role="feed"]';

  await page.waitForSelector(panel);

  let lastHeight = 0;

  while (true) {
    await page.evaluate(() => {
      const el = document.querySelector('div[role="feed"]');
      el.scrollBy(0, 1000);
    });

    await page.waitForTimeout(2000);

    let height = await page.evaluate(() => {
      return document.querySelector('div[role="feed"]').scrollHeight;
    });

    if (height == lastHeight) break;

    lastHeight = height;
  }
}

module.exports = scrollResults;
