/**
 * Autostart Service — platform-specific login item configuration
 * User-level only, no sudo/admin required
 *
 * Linux: ~/.config/autostart/trackmebaby.desktop
 * macOS: ~/Library/LaunchAgents/trackmebaby.plist
 * Windows: Registry HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";

const APP_ID = "trackmebaby";
const APP_NAME = "trackmebaby";

const logger = createLogger("autostart");

export class AutostartService {
    private platform: string;

    constructor(platform: string = process.platform) {
        this.platform = platform;
    }

    /**
     * Enable autostart for the current platform.
     * @param executablePath - Path to the application executable
     */
    async enable(executablePath?: string): Promise<boolean> {
        try {
            const exePath = executablePath || process.execPath;

            switch (this.platform) {
                case "linux":
                    return this.enableLinux(exePath);
                case "darwin":
                    return this.enableMacOS(exePath);
                case "win32":
                    return await this.enableWindows(exePath);
                default:
                    logger.warn("unsupported platform", {
                        platform: this.platform,
                    });
                    return false;
            }
        } catch (err: unknown) {
            logger.error("failed to enable", { error: toErrorData(err) });
            return false;
        }
    }

    /**
     * Disable autostart for the current platform.
     */
    async disable(): Promise<boolean> {
        try {
            switch (this.platform) {
                case "linux":
                    return this.disableLinux();
                case "darwin":
                    return this.disableMacOS();
                case "win32":
                    return await this.disableWindows();
                default:
                    return false;
            }
        } catch (err: unknown) {
            logger.error("failed to disable", { error: toErrorData(err) });
            return false;
        }
    }

    /**
     * Check if autostart is currently enabled.
     */
    async isEnabled(): Promise<boolean> {
        try {
            switch (this.platform) {
                case "linux":
                    return this.isEnabledLinux();
                case "darwin":
                    return this.isEnabledMacOS();
                case "win32":
                    return await this.isEnabledWindows();
                default:
                    return false;
            }
        } catch (err: unknown) {
            logger.warn("failed to check status", { error: toErrorData(err) });
            return false;
        }
    }

    // --- Linux: .desktop file in ~/.config/autostart/ ---

    private getLinuxDesktopPath(): string {
        const configDir =
            process.env.XDG_CONFIG_HOME ||
            join(process.env.HOME || "/tmp", ".config");
        const autostartDir = join(configDir, "autostart");
        mkdirSync(autostartDir, { recursive: true });
        return join(autostartDir, `${APP_NAME}.desktop`);
    }

    private enableLinux(exePath: string): boolean {
        const desktopEntry = `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=Developer activity tracker
Exec=${exePath}
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;
        const path = this.getLinuxDesktopPath();
        writeFileSync(path, desktopEntry, "utf-8");
        logger.info("linux autostart created", { path });
        return true;
    }

    private disableLinux(): boolean {
        const path = this.getLinuxDesktopPath();
        if (existsSync(path)) {
            unlinkSync(path);
            logger.info("linux autostart removed", { path });
        }
        return true;
    }

    private isEnabledLinux(): boolean {
        return existsSync(this.getLinuxDesktopPath());
    }

    // --- macOS: LaunchAgent plist ---

    private getMacOSPlistPath(): string {
        const launchAgentsDir = join(
            process.env.HOME || "/tmp",
            "Library",
            "LaunchAgents",
        );
        mkdirSync(launchAgentsDir, { recursive: true });
        return join(launchAgentsDir, `${APP_ID}.plist`);
    }

    private enableMacOS(exePath: string): boolean {
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${APP_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${exePath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
`;
        const path = this.getMacOSPlistPath();
        writeFileSync(path, plist, "utf-8");
        logger.info("macos autostart created", { path });
        return true;
    }

    private disableMacOS(): boolean {
        const path = this.getMacOSPlistPath();
        if (existsSync(path)) {
            unlinkSync(path);
            logger.info("macos autostart removed", { path });
        }
        return true;
    }

    private isEnabledMacOS(): boolean {
        return existsSync(this.getMacOSPlistPath());
    }

    // --- Windows: Registry ---

    private async enableWindows(exePath: string): Promise<boolean> {
        await Bun.$`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${APP_NAME} /t REG_SZ /d "${exePath}" /f`.quiet();
        logger.info("windows autostart added", { appName: APP_NAME });
        return true;
    }

    private async disableWindows(): Promise<boolean> {
        try {
            await Bun.$`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${APP_NAME} /f`.quiet();
            logger.info("windows autostart removed", { appName: APP_NAME });
        } catch (err: unknown) {
            logger.warn("windows registry key not found", {
                error: toErrorData(err),
            });
        }
        return true;
    }

    private async isEnabledWindows(): Promise<boolean> {
        try {
            await Bun.$`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${APP_NAME}`.quiet();
            return true;
        } catch (err: unknown) {
            logger.warn("failed to query windows registry", {
                error: toErrorData(err),
            });
            return false;
        }
    }
}
