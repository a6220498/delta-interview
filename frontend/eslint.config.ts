import js from '@eslint/js'
import vueTsConfig from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

// A plain flat-config array rather than `defineConfig(...)`: under pnpm the
// helper's types and @vue/eslint-config-typescript's resolve to two different
// copies of @eslint/core, which `vue-tsc` reports as a type error even though
// the config itself is valid.
export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      // Build output of `pnpm generate`; owned by api/openapi.yaml, not by us.
      'src/api/generated/**',
    ],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vueTsConfig(),

  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // The contract is the source of truth for transport shapes; an `any`
      // here would quietly opt a call site out of it.
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
]
