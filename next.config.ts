import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    optimizePackageImports: ["recharts", "cmdk"],
  },
}

export default nextConfig
