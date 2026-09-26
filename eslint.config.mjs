import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // Ban `constructor.name` string equality checks. Vercel minifies the
    // client bundle and renames every class to a short letter (e.g.
    // PDFTextField -> 'e'), so string comparisons against unminified class
    // names silently match nothing in production. This is exactly the
    // blank-permit-application bug fixed in 92e4743 — do not reintroduce it.
    // Use `instanceof` against the real exported class instead.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "BinaryExpression[operator=/^===?$/][left.type='MemberExpression'][left.property.name='name'][left.object.type='MemberExpression'][left.object.property.name='constructor']",
          message: "Do not compare `x.constructor.name` to a string — production minification renames class names (e.g. 'PDFTextField' -> 'e'), so this silently matches nothing. Use `instanceof` against the actual class instead. See src/lib/forms/pdf-fill.ts for the pattern.",
        },
      ],
    },
  },
];

export default eslintConfig;
