/**
 * Windows-only: Control the native title bar dark/light mode via the DWM API.
 * Uses PowerShell .NET interop — more reliable than raw FFI for system DLLs.
 * All exports are no-ops on non-Windows platforms.
 */

import fs from "node:fs";
import { join } from "node:path";

/**
 * Apply dark or light mode to the native title bar of the window with the
 * given title. Supports Windows 10 20H1+ and Windows 11.
 * Silently does nothing on non-Windows platforms.
 */
export async function setTitleBarDarkMode(
    windowTitle: string,
    isDark: boolean,
): Promise<void> {
    if (process.platform !== "win32") return;
    const v = isDark ? 1 : 0;

    // At runtime the cwd is the bin/ folder inside the build tree, so the
    // bundled assets live one level up under Resources/. We probe several
    // candidate paths in order and use the first one that exists.
    const iconCandidates = [
        join(
            process.cwd(),
            "..",
            "Resources",
            "app",
            "views",
            "assets",
            "trackmebaby.png",
        ),
        join(
            process.cwd(),
            "..",
            "Resources",
            "app",
            "views",
            "assets",
            "trackmebaby.ico",
        ),
        join(process.cwd(), "views", "assets", "trackmebaby.png"),
        join(process.cwd(), "assets", "trackmebaby.png"),
        join(process.cwd(), "views", "assets", "trackmebaby.ico"),
        join(process.cwd(), "assets", "trackmebaby.ico"),
    ];
    const iconPath =
        iconCandidates.find((p) => fs.existsSync(p)) ?? iconCandidates[0];

    const pinvoke = `
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DWM_TitleBar {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndIA, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int val, int s);

    public static IntPtr FindRealWindow(string term) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                if (sb.ToString().ToLower().Contains(term.ToLower())) {
                    found = hWnd;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
`;

    const cmd =
        `Add-Type -AssemblyName System.Drawing;` +
        `try{Add-Type -TypeDefinition '${pinvoke}' -ErrorAction Stop}catch{};` +
        `$h=[DWM_TitleBar]::FindRealWindow('${windowTitle}');` +
        `Write-Output "HWND:$h";` +
        `if($h -ne [IntPtr]::Zero){$v=${v};` +
        `[DWM_TitleBar]::DwmSetWindowAttribute($h,20,[ref]$v,4);` +
        `[DWM_TitleBar]::DwmSetWindowAttribute($h,19,[ref]$v,4);` +
        `$iconPath='${iconPath.replace(/'/g, "''")}';` +
        `Write-Output "ICONPATH:$iconPath";` +
        `try{$icon=[System.Drawing.Bitmap]::FromFile($iconPath).GetHicon();}catch{$icon=[IntPtr]::Zero};` +
        `Write-Output "ICON:$icon";` +
        `if($icon -ne [IntPtr]::Zero){` +
        `[DWM_TitleBar]::SendMessage($h,0x0080,[IntPtr]0,$icon);` +
        `[DWM_TitleBar]::SendMessage($h,0x0080,[IntPtr]1,$icon);` +
        `}` +
        `[DWM_TitleBar]::SetWindowPos($h,[IntPtr]::Zero,0,0,0,0,0x0027);` +
        `Write-Output "DONE"` +
        `}`;

    // MUST pass base64 to avoid quote escape stripping issues in child_process.
    // '-EncodedCommand' requires UTF-16LE base64 payload.
    const encoded = Buffer.from(cmd, "utf16le").toString("base64");

    const psPath = join(
        process.env.SystemRoot || "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
    );

    console.log(
        "[windows-titlebar] cwd:",
        process.cwd(),
        "| iconPath:",
        iconPath,
        "| exists:",
        fs.existsSync(iconPath),
    );

    try {
        const proc = Bun.spawn(
            [
                psPath,
                "-NoProfile",
                "-NonInteractive",
                "-EncodedCommand",
                encoded,
            ],
            { stdout: "pipe", stderr: "pipe", stdin: "ignore" },
        );
        await proc.exited;
        const out = await new Response(proc.stdout).text();
        const err = await new Response(proc.stderr).text();
        console.log("[windows-titlebar] PS stdout:", out.trim());
        if (err.trim() && !err.includes("CLIXML"))
            console.error("[windows-titlebar] PS stderr:", err.trim());
    } catch (err: unknown) {
        console.error(
            "[windows-titlebar] DWM error:",
            err instanceof Error ? err.message : err,
        );
    }
}

/**
 * Read the Windows system dark mode preference from the registry.
 * Returns true when the system is in dark mode.
 * Falls back to false (light) on any error.
 */
export async function isSystemDarkMode(): Promise<boolean> {
    if (process.platform !== "win32") return false;
    try {
        const result =
            await Bun.$`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme`
                .quiet()
                .nothrow();
        const text = result.stdout.toString();
        const match = text.match(
            /AppsUseLightTheme\s+REG_DWORD\s+(0x[\da-f]+)/i,
        );
        if (match) {
            return parseInt(match[1], 16) === 0; // 0 = dark mode
        }
        return false;
    } catch {
        return false;
    }
}
