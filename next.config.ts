import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["recharts", "cmdk"],
  },
}

export default nextConfig
