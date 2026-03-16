/**
 * tools/contract_sync.js
 * =======================
 * OpenAPI contract sync tool.
 *
 * Generates an OpenAPI schema from the Express.js gateway routes
 * and syncs a TypeScript client to the dashboard.
 *
 * Usage:
 *   node tools/contract_sync.js              # generate spec
 *   node tools/contract_sync.js --sync       # generate + sync TS client
 *   node tools/contract_sync.js --watch      # watch gateway.js and re-sync on change
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const GATEWAY_FILE = path.join(ROOT, "api", "gateway.js");
const OPENAPI_OUT = path.join(ROOT, "agents", "gpt_actions", "openapi.json");
const TS_CLIENT_OUT = path.join(ROOT, "dashboard", "api", "schema.d.ts");

// ── Route extraction ─────────────────────────────────────────────────────────

function extractRoutes(gatewaySource) {
  const routes = [];
  const re = /app\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(gatewaySource)) !== null) {
    routes.push({ method: match[1].toLowerCase(), path: match[2] });
  }
  return routes;
}

// ── OpenAPI builder ──────────────────────────────────────────────────────────

function buildOpenApiSpec(routes) {
  const paths = {};

  for (const { method, path: routePath } of routes) {
    if (!paths[routePath]) paths[routePath] = {};

    const params = [];
    const paramRe = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let pm;
    while ((pm = paramRe.exec(routePath)) !== null) {
      params.push({
        name: pm[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }

    paths[routePath][method] = {
      summary: `${method.toUpperCase()} ${routePath}`,
      operationId: `${method}_${routePath.replace(/[^a-zA-Z0-9]/g, "_")}`,
      parameters: params,
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { success: { type: "boolean" } },
              },
            },
          },
        },
        500: { description: "Internal server error" },
      },
    };

    if (["post", "put", "patch"].includes(method)) {
      paths[routePath][method].requestBody = {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      };
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "XPS Intelligence API",
      version: "1.0.0",
      description: "Autonomous lead intelligence platform REST API",
    },
    servers: [{ url: "http://localhost:3200", description: "Local gateway" }],
    paths,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function generateSpec() {
  if (!fs.existsSync(GATEWAY_FILE)) {
    console.error("gateway.js not found:", GATEWAY_FILE);
    process.exit(1);
  }

  const source = fs.readFileSync(GATEWAY_FILE, "utf8");
  const routes = extractRoutes(source);
  console.log(`Found ${routes.length} routes in gateway.js`);

  const spec = buildOpenApiSpec(routes);
  fs.mkdirSync(path.dirname(OPENAPI_OUT), { recursive: true });
  fs.writeFileSync(OPENAPI_OUT, JSON.stringify(spec, null, 2));
  console.log("OpenAPI spec written to:", OPENAPI_OUT);
  return spec;
}

function syncFrontendClient() {
  fs.mkdirSync(path.dirname(TS_CLIENT_OUT), { recursive: true });
  try {
    execSync(
      `npx --yes openapi-typescript ${JSON.stringify(OPENAPI_OUT)} --output ${JSON.stringify(TS_CLIENT_OUT)}`,
      { stdio: "inherit", timeout: 60000, shell: false },
    );
    console.log("TypeScript client written to:", TS_CLIENT_OUT);
  } catch (err) {
    console.warn(
      "openapi-typescript not available – writing simple stub client",
    );
    const stub = `// Auto-generated API client stub\n// Run: npx openapi-typescript openapi.json --output schema.d.ts\nexport type ApiSuccess = { success: boolean; data?: unknown };\n`;
    fs.writeFileSync(TS_CLIENT_OUT, stub);
  }
}

function watchGateway() {
  console.log("Watching gateway.js for changes…");
  let debounce;
  fs.watch(GATEWAY_FILE, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log("Change detected – regenerating spec…");
      generateSpec();
      syncFrontendClient();
    }, 500);
  });
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
generateSpec();
if (args.includes("--sync") || args.includes("--watch")) {
  syncFrontendClient();
}
if (args.includes("--watch")) {
  watchGateway();
}
