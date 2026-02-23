import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "trackmebaby",
		identifier: "dev.trackmebaby.app",
		version: "0.1.0",
	},
	runtime: {
		exitOnLastWindowClosed: false,
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
