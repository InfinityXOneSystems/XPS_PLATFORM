"use strict";

class ProxyRotationSystem {
  constructor() {
    this.proxies = [];
    this.failures = new Map();
    this.currentIndex = 0;
    this.MAX_FAILURES = 3;
  }

  addProxy(url) {
    if (!url || this.proxies.includes(url)) return;
    this.proxies.push(url);
    this.failures.set(url, 0);
  }

  getProxy() {
    const healthy = this.getHealthy();
    if (healthy.length === 0) return null;
    const proxy = healthy[this.currentIndex % healthy.length];
    this.currentIndex = (this.currentIndex + 1) % healthy.length;
    return proxy;
  }

  markFailed(proxy) {
    const count = (this.failures.get(proxy) || 0) + 1;
    this.failures.set(proxy, count);
    if (count >= this.MAX_FAILURES) {
      console.warn(
        `[ProxyRotation] Removing proxy ${proxy} after ${count} failures`,
      );
      this.proxies = this.proxies.filter((p) => p !== proxy);
      this.failures.delete(proxy);
      this.currentIndex = 0;
    }
  }

  getHealthy() {
    return this.proxies.filter(
      (p) => (this.failures.get(p) || 0) < this.MAX_FAILURES,
    );
  }

  loadFromEnv() {
    const raw = process.env.PROXY_LIST || "";
    const urls = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    urls.forEach((url) => this.addProxy(url));
    console.info(
      `[ProxyRotation] Loaded ${urls.length} proxies from environment`,
    );
    return urls.length;
  }
}

module.exports = ProxyRotationSystem;
