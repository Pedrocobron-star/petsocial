// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge functions rodam em Deno e usam URL imports — não eslint do cliente
    // resolve esses. Ignoramos pra não poluir o output com false-positives.
    // Scripts utilitários (Node ESM) também ficam fora do lint do app.
    ignores: ['dist/*', 'supabase/functions/**', 'scripts/**', 'public/**'],
  },
]);
