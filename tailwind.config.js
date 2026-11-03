/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0a0b0e',
          card: '#12141a',
          surface: '#181b22',
          border: '#272c38',
          orange: '#ff5e1e', // accents and text on dark (6:1); too light behind white text
          orangeHover: '#e04c10',
          action: '#c2410c', // buttons with white text (5.2:1)
          actionHover: '#9a3412',
          success: '#15803d', // white text 5.0:1
          info: '#2563eb', // white text 5.2:1
          accent: '#3b82f6',
          gold: '#eab308',
          green: '#22c55e',
          red: '#ef4444'
        }
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out'
      }
    }
  },
  plugins: []
};
