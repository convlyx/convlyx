import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React 19 / React Compiler's new lint plugin flags every
      // setState-inside-useEffect call as an error. Many of our cases are
      // legitimate "sync external state into React" patterns (auto-open
      // modals, URL param sync, etc.). Keep it as a warning so the
      // suggestion still surfaces without blocking CI; clean up case-by-case.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
