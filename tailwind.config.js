/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				'mac-bg': 'var(--mac-bg)',
				'mac-surface': 'var(--mac-surface)',
				'mac-sidebar': 'var(--mac-sidebar)',
				'mac-border': 'var(--mac-border)',
				'mac-text': 'var(--mac-text)',
				'mac-secondary': 'var(--mac-secondary)',
				'mac-accent': 'var(--mac-accent)',
				'mac-hover': 'var(--mac-hover)',
			},
			fontFamily: {
				sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'Inter', 'sans-serif'],
				playfair: ['"Playfair Display"', 'serif'],
			},
			borderRadius: {
				'mac': '10px',
				'mac-lg': '12px',
			},
			boxShadow: {
				'mac': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
				'mac-md': '0 4px 12px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
				'mac-lg': '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
			},
		},
	},
	plugins: [],
};
