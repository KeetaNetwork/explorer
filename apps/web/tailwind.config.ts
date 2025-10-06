import type { Config } from "tailwindcss"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
		path.join(__dirname, "node_modules/@keetanetwork/web-ui/**/*.{js,ts,jsx,tsx}"),
	],
	theme: { extend: {} },
	plugins: [],
} satisfies Config
