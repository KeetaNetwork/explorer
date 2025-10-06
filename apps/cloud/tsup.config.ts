import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	bundle: true,
	splitting: false,
	sourcemap: false,
	clean: true,
	target: 'node20',
	platform: 'node',
	format: ['cjs'],
	outDir: 'dist/cloud',
	dts: true,
	shims: false,
	treeshake: true,
})
