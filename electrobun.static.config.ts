export const ELECTROBUN_STATIC_BUILD = {
    mac: {
        bundleCEF: false,
        icons: "assets/trackmebaby.iconset",
    },
    linux: {
        bundleCEF: false,
        icon: "assets/trackmebaby.png",
    },
    win: {
        bundleCEF: false,
        icon: "assets/trackmebaby.ico",
    },
} as const;

export const ELECTROBUN_RUNTIME = {
    exitOnLastWindowClosed: false,
} as const;
