import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: process.env.SKIP_TSC === "1" },
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["recharts", "cmdk"],
  },
}

export default nextConfig
