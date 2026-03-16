"use strict";

require("dotenv").config();
const axios = require("axios");

const GITHUB_API = "https://api.github.com";

// Workflow file names as defined in .github/workflows/
const WORKFLOW_IDS = {
  lead_pipeline: "lead_pipeline.yml",
  repo_guardian: "repo_guardian.yml",
  national_discovery: "national_discovery.yml",
};

class GitHubWorkflowDispatcher {
  constructor() {
    this._token = process.env.GITHUB_TOKEN;
    this._owner =
      process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_OWNER;
    this._repo = process.env.GITHUB_REPOSITORY
      ? process.env.GITHUB_REPOSITORY.split("/")[1]
      : process.env.GITHUB_REPO;

    this._client = axios.create({
      baseURL: GITHUB_API,
      timeout: 15000,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
      },
    });
  }

  _requireAuth() {
    if (!this._token)
      throw new Error(
        "GITHUB_TOKEN env var is required for workflow dispatch.",
      );
    if (!this._owner || !this._repo) {
      throw new Error(
        "GITHUB_REPOSITORY_OWNER and GITHUB_REPO env vars are required.",
      );
    }
  }

  async dispatch(workflowId, ref = "main", inputs = {}) {
    this._requireAuth();
    try {
      const response = await this._client.post(
        `/repos/${this._owner}/${this._repo}/actions/workflows/${workflowId}/dispatches`,
        { ref, inputs },
      );
      return {
        success: true,
        workflow: workflowId,
        ref,
        inputs,
        status: response.status,
        message: `Workflow "${workflowId}" dispatched on ref "${ref}".`,
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      console.error(`[GitHubWorkflowDispatcher] dispatch failed: ${msg}`);
      return { success: false, error: msg, workflow: workflowId };
    }
  }

  async listWorkflows() {
    this._requireAuth();
    try {
      const response = await this._client.get(
        `/repos/${this._owner}/${this._repo}/actions/workflows`,
      );
      const workflows = (response.data.workflows || []).map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state,
        url: w.html_url,
      }));
      return { success: true, workflows, total: workflows.length };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { success: false, error: msg, workflows: [] };
    }
  }

  async getWorkflowRuns(workflowId, perPage = 10) {
    this._requireAuth();
    try {
      const response = await this._client.get(
        `/repos/${this._owner}/${this._repo}/actions/workflows/${workflowId}/runs`,
        { params: { per_page: perPage } },
      );
      const runs = (response.data.workflow_runs || []).map((r) => ({
        id: r.id,
        status: r.status,
        conclusion: r.conclusion,
        created_at: r.created_at,
        updated_at: r.updated_at,
        url: r.html_url,
        branch: r.head_branch,
      }));
      return { success: true, runs, total_count: response.data.total_count };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { success: false, error: msg, runs: [] };
    }
  }

  async dispatchLeadPipeline(ref = "main", inputs = {}) {
    return this.dispatch(WORKFLOW_IDS.lead_pipeline, ref, inputs);
  }

  async dispatchRepoGuardian(ref = "main", inputs = {}) {
    return this.dispatch(WORKFLOW_IDS.repo_guardian, ref, inputs);
  }

  async dispatchNationalDiscovery(ref = "main", inputs = {}) {
    return this.dispatch(WORKFLOW_IDS.national_discovery, ref, inputs);
  }
}

module.exports = GitHubWorkflowDispatcher;
