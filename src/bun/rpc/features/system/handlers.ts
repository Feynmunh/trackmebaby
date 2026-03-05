import { spawnSync } from "node:child_process";
import { emitLog } from "../../../../shared/logger.ts";

export function createSystemMessageHandlers() {
    return {
        log: ({
            entry,
        }: {
            entry: import("../../../../shared/logger.ts").LogEntry;
        }) => {
            entry.timestamp = new Date().toISOString();
            emitLog(entry);
        },
    };
}

export function createSystemRequestHandlers() {
    return {
        readClipboardImage: () => {
            const platform = process.platform;

            try {
                // --- macOS (pbpaste) ---
                if (platform === "darwin") {
                    const result = spawnSync("pbpaste", ["-Prefer", "png"]);
                    if (
                        result.status === 0 &&
                        result.stdout &&
                        result.stdout.length > 0
                    ) {
                        const base64 = result.stdout.toString("base64");
                        return { dataUrl: `data:image/png;base64,${base64}` };
                    }
                }
                // --- Windows (PowerShell) ---
                else if (platform === "win32") {
                    const psCommand =
                        "[Convert]::ToBase64String((Get-Clipboard -Format Image).Save([System.IO.MemoryStream]::new(), [System.Drawing.Imaging.ImageFormat]::Png).ToArray())";
                    const result = spawnSync("powershell", [
                        "-NoProfile",
                        "-Command",
                        psCommand,
                    ]);
                    if (
                        result.status === 0 &&
                        result.stdout &&
                        result.stdout.length > 0
                    ) {
                        const base64 = result.stdout.toString().trim();
                        return { dataUrl: `data:image/png;base64,${base64}` };
                    }
                }
                // --- Linux (wl-paste / xclip) ---
                else if (platform === "linux") {
                    const formats = [
                        "image/png",
                        "image/jpeg",
                        "image/bmp",
                        "image/tiff",
                    ];
                    const selections = ["clipboard", "primary"];

                    for (const selection of selections) {
                        for (const format of formats) {
                            let result = spawnSync(
                                "wl-paste",
                                [
                                    "-p",
                                    selection === "primary" ? "" : "-n",
                                    "-t",
                                    format,
                                ].filter(Boolean),
                            );

                            if (result.status !== 0) {
                                result = spawnSync("xclip", [
                                    "-selection",
                                    selection,
                                    "-t",
                                    format,
                                    "-o",
                                ]);
                            }

                            if (
                                result.status === 0 &&
                                result.stdout &&
                                result.stdout.length > 0
                            ) {
                                const base64 = result.stdout.toString("base64");
                                return {
                                    dataUrl: `data:${format};base64,${base64}`,
                                };
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("[RPC] Failed to read clipboard image:", err);
            }

            return { dataUrl: null };
        },
    };
}
