import { defineConfig } from 'vitest/config';
import path from 'path';

// Standalone test config — deliberately does NOT import vite.config.ts (which
// requires PORT/BASE_PATH). Only the alias resolution is mirrored so tests can
// import app modules the same way the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});
