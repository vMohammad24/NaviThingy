import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: 'var(--color-primary)',
				secondary: 'var(--color-secondary)',
				background: 'var(--color-background)',
				surface: 'var(--color-surface)',
				text: 'var(--color-text)',
				'text-secondary': 'var(--color-text-secondary)'
			},
			animation: {
				progress: 'progress 2s linear infinite',
				'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
				gradient: 'gradient 4s linear infinite',
				pulse: 'pulse 1s ease-in-out infinite',
				'word-highlight': 'word-highlight 0.5s ease-out forwards',
				'word-fade': 'word-fade 0.3s ease-in-out',
				'bounce-subtle': 'bounce-subtle 0.6s ease-in-out',
				glow: 'glow 2s ease-in-out infinite',
				'scale-in': 'scale-in 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards',
				'scale-out': 'scale-out 0.4s cubic-bezier(0.55, 0.08, 0.68, 0.94) forwards',
				'fade-up': 'fade-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards',
				float: 'float 3s ease-in-out infinite'
			},
			keyframes: {
				progress: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'pulse-slow': {
					'0%, 100%': {
						opacity: '0.8',
						transform: 'scale(1)'
					},
					'50%': {
						opacity: '1',
						transform: 'scale(1.1)'
					}
				},
				pulse: {
					'0%, 100%': {
						opacity: '1',
						transform: 'scale(1)'
					},
					'50%': {
						opacity: '0.5',
						transform: 'scale(1.05)'
					}
				},
				gradient: {
					'0%': { backgroundPosition: '0% 50%' },
					'100%': { backgroundPosition: '200% 50%' }
				},
				'word-highlight': {
					'0%': {
						transform: 'scale(1)',
						opacity: '0.7'
					},
					'50%': {
						transform: 'scale(1.15)',
						opacity: '1'
					},
					'100%': {
						transform: 'scale(1.05)',
						opacity: '1'
					}
				},
				'word-fade': {
					'0%': { opacity: '0.5' },
					'100%': { opacity: '1' }
				},
				'bounce-subtle': {
					'0%, 100%': {
						transform: 'translateY(0)'
					},
					'50%': {
						transform: 'translateY(-3px)'
					}
				},
				glow: {
					'0%, 100%': {
						textShadow: '0 0 0px rgba(var(--color-primary-rgb, 100, 100, 255), 0)'
					},
					'50%': {
						textShadow: '0 0 15px rgba(var(--color-primary-rgb, 100, 100, 255), 0.4)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.9)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'scale-out': {
					'0%': {
						transform: 'scale(1)',
						opacity: '1'
					},
					'100%': {
						transform: 'scale(0.95)',
						opacity: '0'
					}
				},
				'fade-up': {
					'0%': {
						transform: 'translateY(10px)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1'
					}
				},
				float: {
					'0%, 100%': {
						transform: 'translateY(0)'
					},
					'50%': {
						transform: 'translateY(-5px)'
					}
				}
			},
			textShadow: {
				primary: '0 0 15px rgba(var(--color-primary-rgb, 100, 100, 255), 0.4)',
				none: 'none'
			},
			boxShadow: {
				'3xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
			}
		}
	},
	plugins: [
		({ addUtilities }) =>
			addUtilities({
				'.scrollbar-none': {
					/* IE and Edge */
					'-ms-overflow-style': 'none',
					/* Firefox */
					'scrollbar-width': 'none',
					/* Safari and Chrome */
					'&::-webkit-scrollbar': {
						display: 'none'
					}
				},
				'.scrollbar-default': {
					/* IE and Edge */
					'-ms-overflow-style': 'auto',
					/* Firefox */
					'scrollbar-width': 'auto',
					/* Safari and Chrome */
					'&::-webkit-scrollbar': {
						display: 'block'
					}
				}
			}),
		function ({ addUtilities, theme }) {
			const newUtilities = {
				'.text-shadow-primary': {
					textShadow: '0 0 15px rgba(var(--color-primary-rgb, 100, 100, 255), 0.4)'
				},
				'.text-shadow-none': {
					textShadow: 'none'
				}
			};
			addUtilities(newUtilities);
		}
	]
} satisfies Config;
