module.exports = {
  env: {
    browser: true,
    es6: true,
    commonjs: true,
    node: true,
  },
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:react/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'packages/tsconfigbase.json'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
    '@typescript-eslint/interface-name-prefix': [
      'error',
      { prefixWithI: 'always' }
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/ban-ts-ignore': 'warn',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/triple-slash-reference': 'warn',
    '@typescript-eslint/no-inferrable-types': 'off',
    'no-inner-declarations': 'off',
    'no-prototype-builtins': 'off',
    'no-control-regex': 'warn',
    'no-undef': 'warn',
    'no-case-declarations': 'warn',
    'no-useless-escape': 'off',
    'prefer-const': 'off',
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
