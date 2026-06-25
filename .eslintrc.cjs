/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'sw.js'],
  rules: {
    'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'AssignmentExpression[left.object.name="window"][left.property.name=/^[a-z]/]',
        message: 'Do not assign app state to window globals — use Zustand stores.',
      },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
