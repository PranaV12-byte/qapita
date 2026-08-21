import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Auth0 runs only in Node.js Route Handlers. Loading it through Node avoids
  // bundling its optional crypto paths into the Edge middleware.
  serverExternalPackages: ["@auth0/nextjs-auth0", "@huggingface/transformers"],
  // This repository is nested beneath older folders that also contain lockfiles.
  // Keep file tracing scoped to this actual application root for Vercel builds.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
