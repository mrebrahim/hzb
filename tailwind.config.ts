import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Cairo', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef7f3', 100: '#d5ece2', 500: '#1f8a5b', 600: '#16714a', 700: '#115a3b', 900: '#0a3322' },
      },
    },
  },
  plugins: [],
} satisfies Config;
