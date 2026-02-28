export const ELECTROBUN_STATIC_BUILD = {
    mac: {
        bundleCEF: false,
    },
    linux: {
        bundleCEF: false,
    },
    win: {
        bundleCEF: false,
    },
} as const;

export const ELECTROBUN_RUNTIME = {
    exitOnLastWindowClosed: false,
} as const;
