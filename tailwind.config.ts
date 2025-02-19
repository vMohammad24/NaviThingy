import type { Config } from 'tailwindcss'

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
        'text-secondary': 'var(--color-text-secondary)',
      },
      animation: {
        'progress': 'progress 2s linear infinite',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'gradient': 'gradient 4s linear infinite'
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
        'gradient': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' }
        }
      },
      boxShadow: {
        '3xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }
    },
  },
  plugins: [
    ({ addUtilities }) => addUtilities({
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
    })
  ],
} satisfies Config

