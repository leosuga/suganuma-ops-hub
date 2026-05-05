import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
