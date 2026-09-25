import tseslint from 'typescript-eslint';
import globals from 'globals';

const nondeterministic = [
  { object: 'Math', property: 'random', message: 'Use Rng from sim/core/Rng (deterministic).' },
  { object: 'Math', property: 'sin', message: 'Use DMath.sin (table based, deterministic).' },
  { object: 'Math', property: 'cos', message: 'Use DMath.cos (table based, deterministic).' },
  { object: 'Math', property: 'atan2', message: 'Use DMath.atan2 (deterministic).' },
  { object: 'Math', property: 'pow', message: 'Use DMath.powInt.' },
  { object: 'Math', property: 'exp', message: 'Not allowed in the simulation.' },
  { object: 'Math', property: 'log', message: 'Not allowed in the simulation.' },
  { object: 'Date', property: 'now', message: 'Wall clock is not allowed in the simulation.' },
  { object: 'performance', property: 'now', message: 'Wall clock is not allowed in the simulation.' },
];

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/sim/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', ...nondeterministic],
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'requestAnimationFrame', 'setTimeout', 'setInterval'],
    },
  },
);
