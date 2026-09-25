import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Cloud Run Docker image (see docs/DEPLOYMENT.md)
  output: "standalone",
};

export default nextConfig;
