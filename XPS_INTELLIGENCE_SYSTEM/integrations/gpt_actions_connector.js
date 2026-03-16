"use strict";

require("dotenv").config();
const axios = require("axios");

const DEFAULT_BASE_URL = "http://localhost:3100";

class GPTActionsConnector {
  constructor(baseUrl = null) {
    this._baseUrl = baseUrl || process.env.GPT_ACTIONS_URL || DEFAULT_BASE_URL;
    this._client = axios.create({
      baseURL: this._baseUrl,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async _request(method, endpoint, data = null) {
    try {
      const config = { method, url: endpoint };
      if (data) config.data = data;
      const response = await this._client.request(config);
      return { success: true, data: response.data, status: response.status };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.error || err.message;
      console.error(
        `[GPTActionsConnector] ${method.toUpperCase()} ${endpoint} failed (${status}): ${message}`,
      );
      return {
        success: false,
        error: message,
        status,
        data: null,
      };
    }
  }

  async getLeads(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params ? `/leads?${params}` : "/leads";
    return this._request("get", endpoint);
  }

  async runPipeline(type = "full") {
    return this._request("post", "/pipeline/run", { type });
  }

  async getStats() {
    return this._request("get", "/stats");
  }

  async executeCommand(command) {
    return this._request("post", "/command", { command });
  }

  async healthCheck() {
    return this._request("get", "/health");
  }
}

module.exports = GPTActionsConnector;
