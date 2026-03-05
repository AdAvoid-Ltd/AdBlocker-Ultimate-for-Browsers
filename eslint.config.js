import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import stylisticPlugin from '@stylistic/eslint-plugin';
import { fixupPluginRules } from '@eslint/compat';
import importNewlinesPlugin from 'eslint-plugin-import-newlines';

export default [
  // Base recommended rules (replaces airbnb-base core)
  js.configs.recommended,

  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'src/resources/web-accessible-resources/**',
      'coverage/**',
      'tmp/**',
      'src/resources/filters/**',
      'competitor/project/**',
      '.eslintcache',
    ],
  },

  // Main configuration
  {
    files: ['**/*.js', '**/*.node'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: true,
        page: true,
        context: true,
        __IS_MV3__: true,
        IS_RELEASE: 'readonly',
        IS_FIREFOX_AMO: 'readonly',
        browser: 'readonly',
      },
    },
    plugins: {
      '@stylistic': stylisticPlugin,
      'import': fixupPluginRules(importPlugin),
      'import-newlines': fixupPluginRules(importNewlinesPlugin),
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js'],
        },
      },
    },
    rules: {
      // Core rules (replacing airbnb-base defaults)
      'no-undef': 'error',
      'no-console': 'error',
      'no-await-in-loop': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      // Allow unused vars in catch blocks (common pattern: catch (e) {})
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // Disable rules that cause issues with private class members
      'no-unused-private-class-members': 'off',

      // Import rules
      'import/no-extraneous-dependencies': 'off',
      'import/no-cycle': 'off',
      'import/prefer-default-export': 'off',
      'import/extensions': 'off',
      // Disable due to parse errors with ESLint 9 compatibility
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-unresolved': ['error', {
        ignore: [
          '^tswebextension$',
          '^app$',
          '^engine$',
          '^scripting-controller$',
          '^settings-controller$',
          '^filters-controller$',
          '^rules-limits-controller$',
          '^content-script$',
          '^network-service$',
          '^network-service-settings$',
          '^filters-update-service$',
          '^common-filter-service$',
          '^filter-update-controller$',
          '^@adguard/.*$',
        ],
      }],
      'import-newlines/enforce': ['error', 2, 120],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
          pathGroups: [
            {
              pattern: '@adguard/**',
              group: 'external',
              position: 'after',
            },
            // Place app alias after internal
            {
              pattern: 'app',
              group: 'internal',
              position: 'after',
            },
            // Place engine alias after internal
            {
              pattern: 'engine',
              group: 'internal',
              position: 'after',
            },
            // Place tswebextension alias after internal
            {
              pattern: 'tswebextension',
              group: 'internal',
              position: 'after',
            },
            // Place scripting-controller alias after internal
            {
              pattern: 'scripting-controller',
              group: 'internal',
              position: 'after',
            },
            // Place settings-controller alias after internal
            {
              pattern: 'settings-controller',
              group: 'internal',
              position: 'after',
            },
            // Place filters-controller alias after internal
            {
              pattern: 'filters-controller',
              group: 'internal',
              position: 'after',
            },
            // Place custom-filters-service alias after internal
            {
              pattern: 'custom-filters-service',
              group: 'internal',
              position: 'after',
            },
            // Place extension-update-service alias after internal
            {
              pattern: 'extension-update-service',
              group: 'internal',
              position: 'after',
            },
            // Place rules-limits-controller alias after internal
            {
              pattern: 'rules-limits-controller',
              group: 'internal',
              position: 'after',
            },
            // Place network-service alias after internal
            {
              pattern: 'network-service',
              group: 'internal',
              position: 'after',
            },
            // Place network-service-settings alias after internal
            {
              pattern: 'network-service-settings',
              group: 'internal',
              position: 'after',
            },
            // Place filters-update-service alias after internal
            {
              pattern: 'filters-update-service',
              group: 'internal',
              position: 'after',
            },
            // Place common-filter-service alias after internal
            {
              pattern: 'common-filter-service',
              group: 'internal',
              position: 'after',
            },
            // Place filter-categories-api alias after internal
            {
              pattern: 'filter-categories-api',
              group: 'internal',
              position: 'after',
            },
            // Place settings-api alias after internal
            {
              pattern: 'settings-api',
              group: 'internal',
              position: 'after',
            },
            // Place filter-update-controller alias after internal
            {
              pattern: 'filter-update-controller',
              group: 'internal',
              position: 'after',
            },
            // Separate group for all .pcss styles
            {
              pattern: '*.pcss',
              group: 'object',
              patternOptions: { matchBase: true },
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          /**
           * To include "side effect imports" in plugin checks
           * (like "import 'styles.pcss';")
           */
          warnOnUnassignedImports: true,
        },
      ],

      // Code style rules
      strict: 'off',
      'object-curly-newline': 'off',
      'max-len': [
        'error',
        {
          code: 120,
          comments: 120,
          tabWidth: 2,
          ignoreStrings: true,
          ignoreUrls: true,
          ignoreTrailingComments: false,
          ignoreComments: false,
          ignoreTemplateLiterals: true,
          /**
           * Ignore calls to logger, e.g. logger.error(), because it's easier
           * to find long log messages just via copy-pasting them to the search
           * and line breaks make it harder.
           */
          ignorePattern: 'logger\\.',
        },
      ],

      // Migrated to @stylistic
      indent: 'off',
      'brace-style': 'off',
      'no-multi-spaces': 'off',

      // @stylistic formatting rules (replacing Prettier)
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
          ignoreComments: false,
        },
      ],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/no-multi-spaces': ['error', { ignoreEOLComments: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/operator-linebreak': ['error', 'before'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always',
      }],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],

      // Disabled rules
      'wrap-iife': 'off',
      'func-names': 'off',
      'prefer-destructuring': 'off',
      'consistent-return': 'off',
      curly: ['error', 'all'],
      'dot-notation': 'off',
      'quote-props': 'off',
      'arrow-body-style': 'off',
      'no-use-before-define': 'off',
      'no-useless-escape': 'off',
      'no-param-reassign': 'off',
      'no-shadow': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Wildcard exports are not allowed.',
        },
      ],
      'no-prototype-builtins': 'off',
      'no-continue': 'off',
      'no-bitwise': 'off',
      'no-plusplus': 'off',
      'no-underscore-dangle': 'off',
      'no-unused-expressions': 'off',
      'no-nested-ternary': 'off',
      'no-restricted-globals': 'off',
      'no-alert': 'off',
      'prefer-template': 'off',
    },
  },
];
