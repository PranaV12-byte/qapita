import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // This repository is nested beneath older folders that also contain lockfiles.
  // Keep file tracing scoped to this actual application root for Vercel builds.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
