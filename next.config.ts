import type { NextConfig } from "next";
import path from "node:path";

const ONNXRUNTIME_NODE =
  "node_modules/@huggingface/transformers/node_modules/onnxruntime-node";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@auth0/nextjs-auth0", "@huggingface/transformers"],
  // This repository is nested beneath older folders that also contain lockfiles.
  // Keep file tracing scoped to this actual application root for Vercel builds.
  outputFileTracingRoot: path.join(__dirname),
  // onnxruntime-node ships prebuilt binaries for every OS/arch plus GPU.
  // Netlify functions only need the CPU linux/x64 provider.
  outputFileTracingExcludes: {
    "*": [
      `${ONNXRUNTIME_NODE}/bin/napi-v6/darwin/**`,
      `${ONNXRUNTIME_NODE}/bin/napi-v6/win32/**`,
      `${ONNXRUNTIME_NODE}/bin/napi-v6/linux/arm64/**`,
      `${ONNXRUNTIME_NODE}/bin/napi-v6/linux/x64/libonnxruntime_providers_cuda.so`,
      `${ONNXRUNTIME_NODE}/bin/napi-v6/linux/x64/libonnxruntime_providers_tensorrt.so`,
      "node_modules/@huggingface/transformers/node_modules/onnxruntime-web/**",
    ],
  },
  outputFileTracingIncludes: {
    "/*": [
      "./data/vectors.bin",
      "./data/chunks.json",
      "./data/parents.json",
      "./data/lexical-index.json",
      "./data/index-manifest.json",
      "./public/brand/qapita.png",
      "./public/brand/naspp-transparent.png",
    ],
  },
};

export default nextConfig;
