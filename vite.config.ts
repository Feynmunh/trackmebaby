import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		target: "esnext",
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
