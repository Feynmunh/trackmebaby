import { BrowserWindow } from "electrobun/bun";
import { toErrorMessage } from "../../../../shared/error.ts";
import { setTitleBarDarkMode } from "../../../services/windows-titlebar.ts";

type BrowserWindowInstance = InstanceType<typeof BrowserWindow>;

export interface WindowHandlersDeps {
    getMainWindow: () => BrowserWindowInstance | null;
}

export function createWindowHandlers({ getMainWindow }: WindowHandlersDeps) {
    return {
        getPlatform: () => {
            return process.platform;
        },
        windowMinimize: () => {
            const win = getMainWindow();
            if (win) {
                win.minimize();
                return { success: true };
            }
            return { success: false };
        },
        windowMaximize: () => {
            const win = getMainWindow();
            if (win) {
                if (win.isMaximized()) {
                    win.unmaximize();
                } else {
                    win.maximize();
                }
                return { success: true };
            }
            return { success: false };
        },
        windowClose: () => {
            const win = getMainWindow();
            if (win) {
                win.close();
                return { success: true };
            }
            return { success: false };
        },
        windowGetPosition: () => {
            const win = getMainWindow();
            if (win) {
                return win.getPosition();
            }
            return { x: 0, y: 0 };
        },
        windowSetPosition: ({ x, y }: { x: number; y: number }) => {
            const win = getMainWindow();
            if (win) {
                win.setPosition(x, y);
                return { success: true };
            }
            return { success: false };
        },
        setWindowTheme: async ({ isDark }: { isDark: boolean }) => {
            await setTitleBarDarkMode("trackmebaby", isDark);
            return { success: true };
        },
        openExternalUrl: ({ url }: { url: string }) => {
            try {
                const isLinux = process.platform === "linux";
                const isMac = process.platform === "darwin";
                const isWindows = process.platform === "win32";

                if (isMac) {
                    Bun.spawn(["open", url], {
                        detached: true,
                        stdio: ["ignore", "ignore", "ignore"],
                    }).unref();
                } else if (isWindows) {
                    Bun.spawn(["cmd", "/c", "start", url], {
                        detached: true,
                        stdio: ["ignore", "ignore", "ignore"],
                    }).unref();
                } else if (isLinux) {
                    Bun.spawn(["xdg-open", url], {
                        detached: true,
                        stdio: ["ignore", "ignore", "ignore"],
                    }).unref();
                }
                return { success: true };
            } catch (err: unknown) {
                return { success: false, error: toErrorMessage(err) };
            }
        },
    };
}
