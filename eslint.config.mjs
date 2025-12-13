import js from '@eslint/js';
import stylisticPlugin from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      parser: tseslint.parser,
      globals: { ...globals.node },
      parserOptions: { project: './tsconfig.json' },
    },

    plugins: {
      import: importPlugin,
      '@stylistic': stylisticPlugin,
      '@typescript-eslint': tseslint.plugin,
    },

    settings: { 'import/resolver': { typescript: true } },

    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],

      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      '@stylistic/semi': 'error',
      '@stylistic/function-call-spacing': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
    },
  },
);
