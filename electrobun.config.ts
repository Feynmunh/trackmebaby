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
        // Linux workaround: fs.watch({ recursive: true }) is broken on Linux.
        // Electrobun's watch mode relies on it, so we explicitly list all subdirs.
        // Once Electrobun ships native watch support, this makes it work out-of-the-box.
        watch: [
            "src/bun",
            "src/bun/db",
            "src/bun/rpc",
            "src/bun/services",
            "src/bun/services/ai",
            "src/shared",
        ],
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
