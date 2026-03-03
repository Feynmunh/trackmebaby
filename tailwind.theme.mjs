const theme = {
    extend: {
        colors: {
            app: {
                bg: "hsl(var(--app-bg) / <alpha-value>)",
                surface: "hsl(var(--app-surface) / <alpha-value>)",
                "surface-elevated":
                    "hsl(var(--app-surface-elevated) / <alpha-value>)",
                border: "hsl(var(--app-border) / <alpha-value>)",
                "text-main": "hsl(var(--app-text-main) / <alpha-value>)",
                "text-muted": "hsl(var(--app-text-muted) / <alpha-value>)",
                accent: "hsl(var(--app-accent) / <alpha-value>)",
                hover: "hsl(var(--app-hover) / <alpha-value>)",
                success: "hsl(var(--app-success) / <alpha-value>)",
                warning: "hsl(var(--app-warning) / <alpha-value>)",
                error: "hsl(var(--app-error) / <alpha-value>)",
                info: "hsl(var(--app-info) / <alpha-value>)",
            },
        },
        fontFamily: {
            sans: [
                "-apple-system",
                "BlinkMacSystemFont",
                '"SF Pro Display"',
                '"SF Pro Text"',
                "Inter",
                "sans-serif",
            ],
            playfair: ['"Playfair Display"', "serif"],
            jura: ['"Jura"', "sans-serif"],
        },
        borderRadius: {
            app: "10px",
            "app-lg": "12px",
        },
        boxShadow: {
            "app-sm": "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
            "app-md": "0 4px 12px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            "app-lg": "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        },
    },
};

export default theme;
