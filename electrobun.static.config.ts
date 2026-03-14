export const ELECTROBUN_STATIC_BUILD = {
    mac: {
        bundleCEF: false,
        icons: "assets/icon.iconset",
    },
    linux: {
        bundleCEF: false,
        icon: "assets/icon.png",
    },
    win: {
        bundleCEF: false,
        icon: "assets/icon.ico",
    },
} as const;

export const ELECTROBUN_RUNTIME = {
    exitOnLastWindowClosed: false,
} as const;
