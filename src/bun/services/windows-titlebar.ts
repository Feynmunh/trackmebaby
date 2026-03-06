/**
 * Windows-only: Control the native title bar dark/light mode via the DWM API.
 * Uses PowerShell .NET interop — more reliable than raw FFI for system DLLs.
 * All exports are no-ops on non-Windows platforms.
 */

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

    // Build a PowerShell one-liner that:
    //  1. Defines P/Invoke wrappers for FindWindow + DwmSetWindowAttribute
    //     (try/catch silently ignores "type already defined" on repeated calls)
    //  2. Finds the HWND by window title
    //  3. Sets DWMWA_USE_IMMERSIVE_DARK_MODE (attr 20 for Win10 20H1+, 19 for older Win10)
    //
    // Note: MemberDefinition is wrapped in PowerShell single-quotes, so the
    // inner double-quotes are literal characters — no escaping needed here.
    const pinvoke =
        '[DllImport("dwmapi.dll")]public static extern int DwmSetWindowAttribute(IntPtr h,int a,ref int val,int s);' +
        '[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindow(string c,string t);';

    const cmd =
        `try{Add-Type -Name DWM -Namespace Win32 -MemberDefinition '${pinvoke}' -ErrorAction Stop}catch{};` +
        `$h=[Win32.DWM]::FindWindow($null,'${windowTitle}');` +
        `if($h -ne [IntPtr]::Zero){$v=${v};` +
        `[Win32.DWM]::DwmSetWindowAttribute($h,20,[ref]$v,4);` +
        `[Win32.DWM]::DwmSetWindowAttribute($h,19,[ref]$v,4)}`;

    try {
        const proc = Bun.spawn(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                cmd,
            ],
            { stdout: "ignore", stderr: "ignore", stdin: "ignore" },
        );
        await proc.exited;
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
