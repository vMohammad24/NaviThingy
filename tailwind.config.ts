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

