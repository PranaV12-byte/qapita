import type { NextConfig } from "next";
import path from "node:path";

const ONNXRUNTIME_NODE =
  "node_modules/@huggingface/transformers/node_modules/onnxruntime-node";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Auth0 runs only in Node.js Route Handlers. Loading it through Node avoids
  // bundling its optional crypto paths into the Edge middleware.
  serverExternalPackages: ["@auth0/nextjs-auth0", "@huggingface/transformers"],
  // This repository is nested beneath older folders that also contain lockfiles.
  // Keep file tracing scoped to this actual application root for Vercel builds.
  outputFileTracingRoot: path.join(__dirname),
  // onnxruntime-node ships prebuilt binaries for every OS/arch plus GPU
  // (CUDA/TensorRT) providers. The deployed function only does CPU inference
  // on linux/x64, and those extra binaries (300MB+ for the CUDA provider
  // alone) push the packaged function past the platform's size limit.
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
};

export default nextConfig;
