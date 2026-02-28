/** @type {import('tailwindcss').Config} */
import theme from "./tailwind.theme.mjs";

export default {
    content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
    darkMode: "class",
    theme,
    plugins: [],
};
