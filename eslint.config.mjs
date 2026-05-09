import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "mcp-server/dist/**",
    "mcp-server/node_modules/**",
  ]),
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      // Mocks de Supabase usam `any` intencionalmente — é código de teste,
      // não afeta produção. O Proxy chain não pode ser tipado precisamente.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // These rules have false positives on common patterns like
      // useEffect(() => setMounted(true), []) and resetting form state
      // when props change — both standard React patterns.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
