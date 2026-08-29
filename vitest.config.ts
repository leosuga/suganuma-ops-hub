import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    singleFork: true,
    testTimeout: 10000,
    // DOM tests (*.test.tsx) exigem happy-dom + Docker (Node v25 trava local):
    // rodam via `npm run test:docker` (vitest.dom.config.ts). Aqui só o node env.
    exclude: [
      "**/node_modules/**",
      "tests/queries/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
