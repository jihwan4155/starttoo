import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import prettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  // tseslint.config(...tseslint.configs.recommended), // tseslint v9+
  pluginReact.configs.flat.recommended,
  ...compat.extends("airbnb"),
  ...compat.extends("plugin:@typescript-eslint/recommended"),
  ...compat.extends("plugin:prettier/recommended"), // prettier 연동 규칙
  // ...compat.extends("plugin:react/recommended"), // airbnb에 포함되어 중복될 수 있음
  prettier, // prettier 규칙 적용
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 }, // globals.node 대신 browser 사용
      parser: tseslint.parser, // TypeScript 파서 지정
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: "./tsconfig.json", // TypeScript 프로젝트 경로
      },
    },
    rules: {
      "import/extensions": [
        "error",
        "ignorePackages",
        { ts: "never", tsx: "never" },
      ],
      "react/react-in-jsx-scope": "off",
      "react/jsx-filename-extension": ["warn", { extensions: [".jsx", ".tsx"] }],
    },
  },
  {
    files: ["eslint.config.js", "*.config.js"], // 설정 파일에도 규칙 적용
    rules: {
      "no-underscore-dangle": "off",
      "import/no-extraneous-dependencies": [
        "error",
        { packageDir: __dirname },
      ],
    },
  },
]);