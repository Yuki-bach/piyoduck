import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: true,
    singleQuote: false,
    tabWidth: 2,
    useTabs: false,
    printWidth: 100,
    trailingComma: "all",
    arrowParens: "always",
    bracketSpacing: true,
    endOfLine: "lf",
  },
  lint: {
    plugins: ["typescript", "import", "unicorn", "vitest"],
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    },
    env: {
      browser: true,
    },
    ignorePatterns: ["dist/", "node_modules/", "testdata/"],
    rules: {
      // --- promotion: category default → error ---
      "typescript/no-unnecessary-type-assertion": "error",

      // --- enable: not in any active category ---
      "no-console": "warn",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: "error",
      "typescript/no-explicit-any": "error",
      "import/no-duplicates": "error",
      "typescript/no-deprecated": "warn",

      // --- prefer-* (autofix): modern idioms ---
      // typescript
      "typescript/prefer-includes": "warn",
      "typescript/prefer-function-type": "warn",
      "typescript/prefer-reduce-type-parameter": "warn",
      "typescript/prefer-return-this-type": "warn",
      "typescript/prefer-ts-expect-error": "warn",
      // eslint
      "prefer-exponentiation-operator": "warn",
      "prefer-numeric-literals": "warn",
      "prefer-object-has-own": "warn",
      "prefer-object-spread": "warn",
      // unicorn
      "unicorn/prefer-array-flat": "warn",
      "unicorn/prefer-array-some": "warn",
      "unicorn/prefer-code-point": "warn",
      "unicorn/prefer-date-now": "warn",
      "unicorn/prefer-dom-node-append": "warn",
      "unicorn/prefer-dom-node-dataset": "warn",
      "unicorn/prefer-dom-node-text-content": "warn",
      "unicorn/prefer-keyboard-event-key": "warn",
      "unicorn/prefer-math-min-max": "warn",
      "unicorn/prefer-negative-index": "warn",
      "unicorn/prefer-number-properties": "warn",
      "unicorn/prefer-optional-catch-binding": "warn",
      "unicorn/prefer-prototype-methods": "warn",
      "unicorn/prefer-query-selector": "warn",
      "unicorn/prefer-regexp-test": "warn",
      "unicorn/prefer-spread": "warn",
      "unicorn/prefer-string-raw": "warn",
      "unicorn/prefer-string-replace-all": "warn",
      "unicorn/prefer-string-slice": "warn",
      "unicorn/prefer-string-trim-start-end": "warn",
      "unicorn/prefer-classlist-toggle": "warn",
      "unicorn/prefer-bigint-literals": "warn",
      "unicorn/prefer-class-fields": "warn",
      // vitest
      "vitest/prefer-called-once": "warn",
      "vitest/prefer-called-times": "warn",
      "vitest/prefer-describe-function-title": "warn",
      "vitest/prefer-expect-type-of": "warn",
      "vitest/prefer-import-in-mock": "warn",
      "vitest/prefer-to-be-object": "warn",

      // --- disable: category-enabled but too noisy / incompatible ---
      "typescript/triple-slash-reference": "off",
      "typescript/no-misused-promises": "off",
      "import/no-named-as-default": "off",
      "no-await-in-loop": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "unicorn/no-array-sort": "off",
      "jest/valid-title": "off",
    },
    overrides: [
      {
        files: ["scripts/**/*.ts", "bench/**/*.ts", ".claude/skills/**/*.mjs"],
        rules: {
          "no-console": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
