/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          app: '#f8fafc',
          card: '#ffffff',
        },
      },
      spacing: {
        18: '72px',
        22: '88px',
        30: '120px',
      },
      borderRadius: {
        '4xl': '24px',
      },
      fontSize: {
        'display': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      maxWidth: {
        'content': '640px',
        'wide': '896px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0,0,0,0.06)',
        'card': '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)',
      },
    },
    screens: {
      sm: '320px',
      md: '480px',
      lg: '768px',
      xl: '1024px',
    },
  },
  plugins: [],
};
