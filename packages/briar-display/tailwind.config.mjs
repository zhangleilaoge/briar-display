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
			typography: {
				DEFAULT: {
					css: {
						p: { marginTop: '0.5em', marginBottom: '0.5em' },
						img: { marginTop: '0.5em', marginBottom: '0.5em' },
						video: { marginTop: '0.5em', marginBottom: '0.5em' },
						figure: { marginTop: '0.5em', marginBottom: '0.5em' },
						h1: { marginTop: '1.2em', marginBottom: '0.4em' },
						h2: { marginTop: '1em', marginBottom: '0.4em' },
						h3: { marginTop: '0.8em', marginBottom: '0.3em' },
						h4: { marginTop: '0.6em', marginBottom: '0.3em' },
						ol: { marginTop: '0.5em', marginBottom: '0.5em' },
						ul: { marginTop: '0.5em', marginBottom: '0.5em' },
						li: { marginTop: '0.25em', marginBottom: '0.25em' },
						blockquote: {
							marginTop: '0.75em',
							marginBottom: '0.75em',
							quotes: 'none',
							borderLeftWidth: '0.2em',
							borderLeftColor: 'hsl(var(--border))',
							fontStyle: 'normal',
							paddingLeft: '1em',
						},
						'blockquote p:first-of-type::before': { content: 'none' },
						'blockquote p:last-of-type::after': { content: 'none' },
						pre: { marginTop: '0.75em', marginBottom: '0.75em' },
						hr: { marginTop: '1.5em', marginBottom: '1.5em' },
						table: { marginTop: '1em', marginBottom: '1em' },
					},
				},
			},
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
