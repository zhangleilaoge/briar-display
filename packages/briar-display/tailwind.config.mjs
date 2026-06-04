/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ['class'],
	content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,vue}'],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1200px',
			},
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				chart: {
					1: 'hsl(var(--chart-1))',
					2: 'hsl(var(--chart-2))',
					3: 'hsl(var(--chart-3))',
					4: 'hsl(var(--chart-4))',
					5: 'hsl(var(--chart-5))',
				},
				/* Vector 2022 Wikipedia colors */
				wiki: {
					bg: 'var(--wiki-bg)',
					'bg-secondary': 'var(--wiki-bg-secondary)',
					'bg-tertiary': 'var(--wiki-bg-tertiary)',
					border: 'var(--wiki-border)',
					'border-light': 'var(--wiki-border-light)',
					link: 'var(--wiki-link)',
					'link-hover': 'var(--wiki-link-hover)',
					'link-visited': 'var(--wiki-link-visited)',
					'link-red': 'var(--wiki-link-red)',
					text: 'var(--wiki-text)',
					'text-secondary': 'var(--wiki-text-secondary)',
					'text-muted': 'var(--wiki-text-muted)',
					'tab-active': 'var(--wiki-tab-active)',
					highlight: 'var(--wiki-highlight)',
					'topbar-bg': 'var(--wiki-topbar-bg)',
					'sidebar-bg': 'var(--wiki-sidebar-bg)',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
		},
	},
	plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
}
