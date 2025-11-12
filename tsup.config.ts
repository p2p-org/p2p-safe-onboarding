import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    adapters: 'src/adapters/index.ts',
    config: 'src/config/index.ts',
  },
  format: ['esm', 'cjs'],
  sourcemap: true,
  clean: true,
  dts: true,
  minify: false,
  target: 'es2021',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs'
    }
  }
})

