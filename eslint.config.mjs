// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylisticJs from '@stylistic/eslint-plugin-js'
import pluginChaiFriendly from 'eslint-plugin-chai-friendly';
import namedImportSpacing from 'eslint-plugin-named-import-spacing';

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            '@stylistic/js': stylisticJs,
            'chai-friendly': pluginChaiFriendly,
            'named-import-spacing': namedImportSpacing,
        },
        ignores: ['**/build/', '**/dist/', '**/*.d.ts'],
        languageOptions: {
            // parser: parser,
            parserOptions: {
                project: ['./tsconfig.json', './packages/*/tsconfig.json'],
                projectService: true,
            }
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    "varsIgnorePattern": "^_$",
                    "args": "none",
                    "caughtErrors": "none"
                }
            ],
            "accessor-pairs": [
                "error",
                {
                    "getWithoutSet": false,
                    "setWithoutGet": true
                }
            ],
            "@typescript-eslint/no-this-alias": [
                "off"
            ],
            "@typescript-eslint/no-unused-expressions": "off", // disable original rule
            // "@typescript-eslint/strict-boolean-expressions": "error",
            "chai-friendly/no-unused-expressions": [
                "error",
                {
                    "allowTernary": true
                }
            ],
            "@typescript-eslint/no-empty-object-type": "off",
            "@stylistic/js/semi": "error",
            "@stylistic/js/comma-spacing": "error",
            "@stylistic/js/keyword-spacing": "error",
            "@stylistic/js/no-trailing-spaces": "error",
            "@stylistic/js/eol-last": "error",
            "@stylistic/js/space-infix-ops": "error",
            "@stylistic/js/brace-style": ["error", "stroustrup"],
            "@stylistic/js/no-tabs": "error",
            "@stylistic/js/no-mixed-spaces-and-tabs": "error",
            "@stylistic/js/comma-dangle": ["error", {
                "functions": "never",
                "arrays": "always-multiline",
                "objects": "always-multiline",
                "imports": "never",
                "exports": "never",
            }],
            "getter-return": "error",
            "use-isnan": "error",
            "eqeqeq": "error",
            "no-var": "error",
            "@stylistic/js/indent": ["error", 4, {
                SwitchCase: 1,
                // This makes it ignore continuation indents for when a long class declaration (e.g. lots of
                // 'implements') causes it to wrap to a second line.
                ignoredNodes: ["ClassDeclaration"],
                FunctionExpression: {
                    parameters: "first"
                }
            }],
            "prefer-const": "error",
            "camelcase": "error",
            "block-scoped-var": "error",
            "named-import-spacing/named-import-spacing": ["error", "never"]
        }
    }
];
