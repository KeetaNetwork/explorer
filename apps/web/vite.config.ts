import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from 'vite-plugin-svgr';

export default defineConfig({
	plugins: [
		svgr(),
		tailwindcss(),
		preact(),
		tsconfigPaths(),
	],

	resolve: {
		dedupe: ["preact"],
		alias: [
			{ find: "react", replacement: "preact/compat" },
			{ find: "react-dom/test-utils", replacement: "preact/test-utils" },
			{ find: "react-dom", replacement: "preact/compat" },
			{ find: "react/jsx-runtime", replacement: "preact/jsx-runtime" },
			{ find: "@preact/signals-react", replacement: "@preact/signals" },
		],
	},

	build: {
		minify: true,
		sourcemap: false,
		rollupOptions: {
			treeshake: true,
			output: {
				manualChunks: {
					"preact": ["preact"],
					"preact-jsx-runtime": ["preact/jsx-runtime"],
					"preact-compat": ["preact/compat"],
					"preact-signals": ["@preact/signals"],
					"preact-hooks": ["preact/hooks"],
				}
			}
		}
	},

	server: {
		port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
	}
});
