"use strict";

const axios = require("axios");

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 120000;

class CaptchaSolver {
  constructor() {
    this.apiKey2Captcha =
      process.env.TWOCAPTCHA_API_KEY || process.env["2CAPTCHA_API_KEY"] || "";
  }

  async solve2Captcha(sitekey, url) {
    if (!this.apiKey2Captcha)
      throw new Error("[CaptchaSolver] 2CAPTCHA_API_KEY not set");

    console.info(`[CaptchaSolver] Submitting reCAPTCHA for ${url}`);
    const submitRes = await axios.get("https://2captcha.com/in.php", {
      params: {
        key: this.apiKey2Captcha,
        method: "userrecaptcha",
        googlekey: sitekey,
        pageurl: url,
        json: 1,
      },
    });
    if (submitRes.data.status !== 1) {
      throw new Error(
        `[CaptchaSolver] Submission failed: ${submitRes.data.request}`,
      );
    }
    const taskId = submitRes.data.request;
    console.info(`[CaptchaSolver] Task ID: ${taskId} — polling for result`);

    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await axios.get("https://2captcha.com/res.php", {
        params: {
          key: this.apiKey2Captcha,
          action: "get",
          id: taskId,
          json: 1,
        },
      });
      if (pollRes.data.status === 1) {
        console.info("[CaptchaSolver] reCAPTCHA solved");
        return pollRes.data.request;
      }
      if (pollRes.data.request !== "CAPTCHA_NOT_READY") {
        throw new Error(`[CaptchaSolver] Poll error: ${pollRes.data.request}`);
      }
    }
    throw new Error("[CaptchaSolver] Timed out waiting for 2captcha result");
  }

  async solveHCaptcha(sitekey, url) {
    if (!this.apiKey2Captcha)
      throw new Error("[CaptchaSolver] 2CAPTCHA_API_KEY not set");

    console.info(`[CaptchaSolver] Submitting hCaptcha for ${url}`);
    const submitRes = await axios.get("https://2captcha.com/in.php", {
      params: {
        key: this.apiKey2Captcha,
        method: "hcaptcha",
        sitekey,
        pageurl: url,
        json: 1,
      },
    });
    if (submitRes.data.status !== 1) {
      throw new Error(
        `[CaptchaSolver] hCaptcha submission failed: ${submitRes.data.request}`,
      );
    }
    const taskId = submitRes.data.request;
    console.info(`[CaptchaSolver] hCaptcha Task ID: ${taskId} — polling`);

    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await axios.get("https://2captcha.com/res.php", {
        params: {
          key: this.apiKey2Captcha,
          action: "get",
          id: taskId,
          json: 1,
        },
      });
      if (pollRes.data.status === 1) {
        console.info("[CaptchaSolver] hCaptcha solved");
        return pollRes.data.request;
      }
      if (pollRes.data.request !== "CAPTCHA_NOT_READY") {
        throw new Error(
          `[CaptchaSolver] hCaptcha poll error: ${pollRes.data.request}`,
        );
      }
    }
    throw new Error("[CaptchaSolver] Timed out waiting for hCaptcha result");
  }

  async detectCaptcha(page) {
    try {
      const html = await page.content();
      if (/grecaptcha|recaptcha\.net|google\.com\/recaptcha/i.test(html))
        return "recaptcha";
      if (/hcaptcha\.com/i.test(html)) return "hcaptcha";
      return null;
    } catch (err) {
      console.error("[CaptchaSolver] detectCaptcha error:", err.message);
      return null;
    }
  }

  async autoSolve(page) {
    const type = await this.detectCaptcha(page);
    if (!type) {
      console.info("[CaptchaSolver] No captcha detected");
      return null;
    }
    const url = page.url();
    const html = await page.content();

    let sitekey = null;
    const skMatch =
      html.match(/data-sitekey=["']([^"']+)["']/) ||
      html.match(/sitekey['":\s]+['"]([^"']+)['"]/);
    if (skMatch) sitekey = skMatch[1];

    if (!sitekey) {
      console.warn(
        "[CaptchaSolver] Could not extract sitekey — skipping auto-solve",
      );
      return null;
    }

    const token =
      type === "recaptcha"
        ? await this.solve2Captcha(sitekey, url)
        : await this.solveHCaptcha(sitekey, url);

    await page.evaluate((t) => {
      const el =
        document.getElementById("g-recaptcha-response") ||
        document.querySelector('[name="h-captcha-response"]');
      if (el) el.value = t;
    }, token);

    console.info(`[CaptchaSolver] Token injected for ${type}`);
    return token;
  }
}

module.exports = CaptchaSolver;
