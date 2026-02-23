/**
 * Autostart Service — platform-specific login item configuration
 * User-level only, no sudo/admin required
 *
 * Linux: ~/.config/autostart/trackmebaby.desktop
 * macOS: ~/Library/LaunchAgents/dev.trackmebaby.app.plist
 * Windows: Registry HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 */
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APP_ID = "dev.trackmebaby.app";
const APP_NAME = "trackmebaby";

export class AutostartService {
    private platform: string;

    constructor() {
        this.platform = process.platform;
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
                    console.warn(`[Autostart] Unsupported platform: ${this.platform}`);
                    return false;
            }
        } catch (err: any) {
            console.error(`[Autostart] Failed to enable:`, err.message);
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
        } catch (err: any) {
            console.error(`[Autostart] Failed to disable:`, err.message);
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
        } catch {
            return false;
        }
    }

    // --- Linux: .desktop file in ~/.config/autostart/ ---

    private getLinuxDesktopPath(): string {
        const configDir = process.env.XDG_CONFIG_HOME || join(process.env.HOME || "/tmp", ".config");
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
        console.log(`[Autostart] Linux: Created ${path}`);
        return true;
    }

    private disableLinux(): boolean {
        const path = this.getLinuxDesktopPath();
        if (existsSync(path)) {
            unlinkSync(path);
            console.log(`[Autostart] Linux: Removed ${path}`);
        }
        return true;
    }

    private isEnabledLinux(): boolean {
        return existsSync(this.getLinuxDesktopPath());
    }

    // --- macOS: LaunchAgent plist ---

    private getMacOSPlistPath(): string {
        const launchAgentsDir = join(process.env.HOME || "/tmp", "Library", "LaunchAgents");
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
        console.log(`[Autostart] macOS: Created ${path}`);
        return true;
    }

    private disableMacOS(): boolean {
        const path = this.getMacOSPlistPath();
        if (existsSync(path)) {
            unlinkSync(path);
            console.log(`[Autostart] macOS: Removed ${path}`);
        }
        return true;
    }

    private isEnabledMacOS(): boolean {
        return existsSync(this.getMacOSPlistPath());
    }

    // --- Windows: Registry ---

    private async enableWindows(exePath: string): Promise<boolean> {
        await Bun.$`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${APP_NAME} /t REG_SZ /d "${exePath}" /f`.quiet();
        console.log(`[Autostart] Windows: Added registry key`);
        return true;
    }

    private async disableWindows(): Promise<boolean> {
        try {
            await Bun.$`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${APP_NAME} /f`.quiet();
            console.log(`[Autostart] Windows: Removed registry key`);
        } catch {
            // Key might not exist
        }
        return true;
    }

    private async isEnabledWindows(): Promise<boolean> {
        try {
            await Bun.$`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${APP_NAME}`.quiet();
            return true;
        } catch {
            return false;
        }
    }
}
