import type { Config } from 'tailwindcss';

// هوية مؤسسية: كحلي + أخضر داكن + ذهبي هادي
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#f0f5f2', 100: '#dce8e0', 500: '#2f6b4f', 600: '#1f5640', 700: '#174632', 900: '#0c2a1d' },
        navy: { 50: '#f2f5f9', 100: '#e1e7f0', 200: '#c3cfdf', 500: '#3b5578', 600: '#1e3a5f', 700: '#162d4a', 800: '#0f2238', 900: '#0a1828' },
        gold: { 50: '#faf6ee', 100: '#f1e7d3', 400: '#c9a25f', 500: '#b08d57', 600: '#8f6f3f' },
      },
    },
  },
  plugins: [],
} satisfies Config;
