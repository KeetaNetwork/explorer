import { defineConfig } from 'tsup'

export default defineConfig(() => {	
	return([
		/**
		 * Server configuration
		 */
		{
			entry: ['src/main.ts'],
			bundle: true,
			splitting: false,
			sourcemap: false,
			clean: true,
			minify: false,
			target: 'node20',
			platform: 'node',
			format: ['cjs'],
			outDir: 'dist/server',
			shims: false,
			treeshake: true,
			noExternal: [
				/@keetanetwork\/web-ui-utils/,
				/@keetanetwork\/anchor/,
				/superjson/,
				/hono/,
				/valibot/,
			],
			external: [
				/@keetanetwork\/pulumi-components/,
				"utf-8-validate",
				"bufferutil",
			],
		},

		/**
		 * Client configuration
		 */
		{
			entry: ['src/client/index.ts'],
			bundle: true,
			splitting: true,
			sourcemap: false,
			clean: true,
			dts: {
				entry: 'src/client/index.ts',

				// resolve: !0
				resolve: false
			},
			minify: true,
			treeshake: true,
			target: 'es2020',
			platform: 'browser',
			format: ['esm', 'cjs'],
			outDir: 'dist/client',
			noExternal: [
				"isomorphic-ws",
				/hono/,
				/superjson/,
			]
		}
	])
})
