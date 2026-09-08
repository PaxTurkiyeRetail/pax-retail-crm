import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Claude teslimat klasörü ve harness çıktıları test/derleme kapsamı dışında (tsconfig/eslintignore ile aynı).
    exclude: ['**/node_modules/**', '**/.next/**', 'Claude outputs/**', '.theme-audit/**'],
    passWithNoTests: false,
  },
});
