import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architecture boundaries (CODE_QUALITY §3.4, §4.1, §12.2). ESLint replaces a rule's options
// per matching config block instead of merging them, so each block lists every pattern it needs.
const MODULE_INTERNALS = {
  group: ["@/server/modules/*/*"],
  message: "Import a server module only through its public index (e.g. '@/server/modules/feed').",
};
const SERVER_CODE = {
  group: ["@/server/**", "@/generated/**"],
  message: "Client-safe code must not import server code.",
};
const APP_ROUTES = {
  group: ["@/app/**"],
  message: "Routes compose other code; nothing may import from src/app.",
};
const DOMAIN_COMPONENTS = {
  group: ["@/components/**", "!@/components/ui", "!@/components/ui/**"],
  message: "Shared primitives must not depend on domain or layout components.",
};
const ALL_COMPONENTS = {
  group: ["@/components/**"],
  message: "This layer must not depend on UI components.",
};

function restrictImports(...patterns) {
  return { "no-restricted-imports": ["error", { patterns }] };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Import order and circular-dependency checks (CODE_QUALITY §12).
      // The `import` plugin is registered by eslint-config-next.
      "import/no-cycle": "error",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // Type safety and logging (CODE_QUALITY §6.2, §4.4).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "error",
      ...restrictImports(MODULE_INTERNALS, APP_ROUTES),
    },
  },
  {
    files: ["src/components/ui/**"],
    rules: restrictImports(MODULE_INTERNALS, SERVER_CODE, APP_ROUTES, DOMAIN_COMPONENTS),
  },
  {
    files: ["src/components/**"],
    ignores: ["src/components/ui/**"],
    rules: restrictImports(MODULE_INTERNALS, SERVER_CODE, APP_ROUTES),
  },
  {
    files: ["src/hooks/**", "src/lib/**"],
    rules: restrictImports(MODULE_INTERNALS, SERVER_CODE, APP_ROUTES, ALL_COMPONENTS),
  },
  {
    files: ["src/server/**"],
    rules: restrictImports(MODULE_INTERNALS, APP_ROUTES, ALL_COMPONENTS),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Documentation and exported design files are reference material, not app code.
    "docs/**",
    // Generated Prisma client.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
