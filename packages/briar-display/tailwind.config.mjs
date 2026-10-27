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
				// Reverie 语义状态色（见 src/styles/theme.css）
				success: {
					DEFAULT: 'hsl(var(--success))',
					soft: 'hsl(var(--success-soft))',
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					soft: 'hsl(var(--warning-soft))',
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					soft: 'hsl(var(--info-soft))',
				},
				danger: {
					DEFAULT: 'hsl(var(--danger))',
					soft: 'hsl(var(--danger-soft))',
				},
				plum: {
					DEFAULT: 'hsl(var(--plum))',
					soft: 'hsl(var(--plum-soft))',
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
				// Reverie 主题 token（见 src/styles/theme.css）
				surface: 'var(--radius-surface)',
				control: 'var(--radius-control)',
				field: 'var(--radius-field)',
			},
			fontFamily: {
				display: 'var(--font-display)',
				script: 'var(--font-script)',
				label: 'var(--font-label)',
				heading: 'var(--font-heading)',
				control: 'var(--font-control)',
				mono: 'var(--font-mono)',
			},
			boxShadow: {
				surface: 'var(--shadow-surface)',
				raised: 'var(--shadow-raised)',
				control: 'var(--shadow-control)',
				'control-hover': 'var(--shadow-control-hover)',
				focus: 'var(--glow-focus)',
			},
			letterSpacing: {
				control: 'var(--control-tracking)',
				label: 'var(--label-tracking)',
			},
		},
	},
	plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
}
