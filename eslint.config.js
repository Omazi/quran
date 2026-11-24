// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// The dependency rule of the architecture (see docs/ARCHITECTURE.md):
// the domain is pure TypeScript and must not know about React, Expo, storage or UI.
const FORBIDDEN_IN_DOMAIN = [
  {
    group: ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*'],
    message: 'The domain layer must stay pure TypeScript.',
  },
  {
    group: ['@/data/*', '@/features/*', '@/ui/*', '@/app/*'],
    message: 'The domain layer must not depend on outer layers.',
  },
];

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'node_modules/*', '.expo/*', 'assets/data/*'] },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: FORBIDDEN_IN_DOMAIN }] },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/*', '@/features/*'],
              message: 'The design system must not depend on data or features.',
            },
          ],
        },
      ],
    },
  },
  { files: ['tools/**/*.mjs'], rules: { 'no-console': 'off' } },
]);
