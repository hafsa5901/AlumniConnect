/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8ecf4',
          100: '#c5cfdf',
          200: '#9fb0cc',
          300: '#7891b8',
          400: '#5a78a9',
          500: '#3c5f99',
          600: '#2e4e82',
          700: '#1e3a6e',
          800: '#132a5a',
          900: '#0F1E3D',
          950: '#080f1f',
        },
        accent: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px 0 rgba(15,30,61,0.08)',
        'card-hover': '0 8px 24px 0 rgba(15,30,61,0.14)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
