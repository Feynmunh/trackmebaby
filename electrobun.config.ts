import fs from "node:fs";
import type { ElectrobunConfig } from "electrobun";
import {
    ELECTROBUN_RUNTIME,
    ELECTROBUN_STATIC_BUILD,
} from "./electrobun.static.config.ts";

const packageJson = JSON.parse(
    fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string; description: string };

type ElectrobunConfigWithWatch = ElectrobunConfig & {
    app: ElectrobunConfig["app"] & { description?: string };
    build: ElectrobunConfig["build"] & { watch?: string[] };
};

export default {
    app: {
        name: "trackmebaby",
        identifier: "dev.trackmebaby.app",
        version: packageJson.version,
        description: packageJson.description,
    },
    runtime: ELECTROBUN_RUNTIME,
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
            "src/bun/services/git-tracker",
            "src/bun/services/github",
            "src/shared",
        ],
        // Vite builds to dist/, we copy from there
        copy: {
            "dist/index.html": "views/mainview/index.html",
            "dist/assets": "views/mainview/assets",
            "node_modules/@parcel/watcher-wasm/watcher.wasm":
                "app/bun/watcher.wasm",
            "assets/trackmebaby.png": "views/assets/trackmebaby.png",
            "assets/trackmebaby.ico": "views/assets/trackmebaby.ico",
        },
        ...ELECTROBUN_STATIC_BUILD,
    },
} satisfies ElectrobunConfigWithWatch;
