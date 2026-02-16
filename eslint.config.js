import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import perfectionist from 'eslint-plugin-perfectionist'
import prettierConfig from 'eslint-config-prettier'

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'src-tauri/target/',
      '.husky/',
      'vite.config.ts.timestamp-*',
      '*.config.js',
      '*.config.ts',
      'eslint.config.js',
      'tests/',
    ],
  },

  // Base JavaScript/TypeScript configuration
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        ClipboardItem: 'readonly',
        HTMLElement: 'readonly',
        HTMLPreElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MediaQueryListEvent: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        crypto: 'readonly',
        ResizeObserver: 'readonly',
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      perfectionist,
    },
    rules: {
      // TypeScript
      'no-unused-vars': 'off', // Use @typescript-eslint version instead
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // React
      'react/react-in-jsx-scope': 'off', // React 17+
      'react/prop-types': 'off', // TypeScript로 대체

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-unresolved': 'off', // TypeScript handles this

      // Accessibility
      'jsx-a11y/anchor-is-valid': 'warn',

      // General
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],

      // Keep disabled globally; enable incrementally by scoped overrides below.
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',

      // JSX Props Sorting
      'perfectionist/sort-jsx-props': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          ignoreCase: true,
          partitionByNewLine: true,
          groups: [
            'key',
            'ref',
            'identity',
            'aria',
            'className',
            'unknown',
            'multiline-prop',
            'shorthand-prop',
            'callback',
          ],
          customGroups: [
            { groupName: 'key', elementNamePattern: '^key$' },
            { groupName: 'ref', elementNamePattern: '^ref$' },
            { groupName: 'identity', elementNamePattern: '^(id|name|type|role|htmlFor|for)$' },
            { groupName: 'aria', elementNamePattern: '^aria-.+' },
            { groupName: 'className', elementNamePattern: '^(className|style)$' },
            { groupName: 'callback', elementNamePattern: '^on.+' },
          ],
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
  },

  // Incremental rollout: enforce no-magic-numbers in policy-heavy modules first
  {
    files: [
      'src/stores/**/*.{ts,tsx}',
      'src/components/findreplace/**/*.{ts,tsx}',
      'src/hooks/useFileSystem.ts',
      'src/hooks/useDocumentStats.ts',
      'src/hooks/useKeyboardShortcuts.ts',
      'src/utils/settingsStorage.ts',
    ],
    rules: {
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1, 2, 10],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          enforceConst: true,
          detectObjects: true,
        },
      ],
    },
  },

  // Prettier config (should be last)
  prettierConfig,
]
