import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'client', 'src')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: './vitest.setup.ts',
    tsconfig: 'tsconfig.vitest.json',
    include: ['server/**/*.test.ts', 'client/src/**/*.test.ts']
  }
})
