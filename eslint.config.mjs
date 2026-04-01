// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: ["test/**/*.test.ts"],
      rules: {
        // Allow multiple top-level suites in test files for better organization
        "mocha/max-top-level-suites": ["error", { limit: 10 }],
      },
    },
  ],
});
