/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      "https://xps-intelligence.up.railway.app",
    NEXT_PUBLIC_GATEWAY_URL:
      process.env.NEXT_PUBLIC_GATEWAY_URL ||
      "https://xps-intelligence.up.railway.app",
  },
};

module.exports = nextConfig;
