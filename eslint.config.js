// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['**/build/', '**/dist/', '**/*.d.ts'],
        languageOptions: {
            // parser: parser,
            parserOptions: {
                // project: ['./tsconfig.json', './packages/*/tsconfig.json'],
                projectService: true,
            }
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    "args": "none",
                }
            ],
            "accessor-pairs": [
                "error",
                {
                    "getWithoutSet": false,
                    "setWithoutGet": true
                }
            ],
            "comma-spacing": [
                "error",
                {
                    "before": false,
                    "after": true,
                }
            ],
            "@typescript-eslint/no-this-alias": [
                "off"
            ]
        }
    }
];