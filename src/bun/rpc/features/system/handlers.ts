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
                // --- macOS (osascript + PNGf) ---
                if (platform === "darwin") {
                    // pbpaste only supports text. We use osascript to extract the clipboard as PNG hex and convert.
                    const result = spawnSync("osascript", [
                        "-e",
                        "set theImage to the clipboard as «class PNGf»",
                        "-e",
                        'set theHex to do shell script "xxd -p -c 999999" with input theImage',
                        "-e",
                        "return theHex",
                    ]);
                    if (
                        result.status === 0 &&
                        result.stdout &&
                        result.stdout.length > 0
                    ) {
                        const hex = result.stdout
                            .toString()
                            .replace(/\s+/g, "");
                        if (hex.length > 0) {
                            const pngBuffer = Buffer.from(hex, "hex");
                            const base64 = pngBuffer.toString("base64");
                            return {
                                dataUrl: `data:image/png;base64,${base64}`,
                            };
                        }
                    }
                }
                // --- Windows (PowerShell) ---
                else if (platform === "win32") {
                    // Improved PowerShell script to handle multiple image types and memory streams correctly
                    const psCommand =
                        "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img -eq $null) { exit 1 }; $ms = New-Object System.IO.MemoryStream; $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); [Convert]::ToBase64String($ms.ToArray()); $ms.Dispose(); $img.Dispose();";
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
                    // Optimized to check for common image formats efficiently
                    const formats = ["image/png", "image/jpeg", "image/bmp"];
                    const selections = ["clipboard"]; // Primary usually used for text selection

                    for (const selection of selections) {
                        for (const format of formats) {
                            // Check wl-paste (Wayland)
                            let result = spawnSync("wl-paste", [
                                "-n",
                                "-t",
                                format,
                            ]);

                            // Fallback to xclip (X11)
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
                console.error(
                    "[RPC] Failed to read clipboard image:",
                    err instanceof Error ? err.message : err,
                );
            }

            return { dataUrl: null };
        },
    };
}
