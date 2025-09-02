const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = [
  {
    ignores: ["dist/", ".repos/", "eslint.config.js", "tests/fixtures/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
];
