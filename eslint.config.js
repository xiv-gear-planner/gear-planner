// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginChaiFriendly from 'eslint-plugin-chai-friendly';

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {'chai-friendly': pluginChaiFriendly},
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
            "comma-spacing": [
                "error",
                {
                    "before": false,
                    "after": true,
                }
            ],
            "@typescript-eslint/no-this-alias": [
                "off"
            ],
            "@typescript-eslint/no-unused-expressions": "off", // disable original rule
            "chai-friendly/no-unused-expressions": [
                "error",
                {
                    "allowTernary": true
                }
            ],
            "@typescript-eslint/no-empty-object-type": "off",
        }
    }
];