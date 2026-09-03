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
          800: '#132F4C',
          900: '#0B1F3A',
        },
        blue: {
          50: '#EFF6FF',
          600: '#2563EB',
        },
        slate: {
          50: '#F8FAFC',
          200: '#E2E8F0',
          500: '#64748B',
          900: '#0F172A',
        },
        green: {
          600: '#16A34A',
        },
        amber: {
          600: '#D97706',
        },
        red: {
          600: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(11, 31, 58, 0.06), 0 1px 2px -1px rgba(11, 31, 58, 0.04)',
        'card-hover': '0 10px 25px -5px rgba(11, 31, 58, 0.08), 0 8px 10px -6px rgba(11, 31, 58, 0.04)',
        modal: '0 20px 25px -5px rgba(11, 31, 58, 0.1), 0 8px 10px -6px rgba(11, 31, 58, 0.06)',
      },
      borderRadius: {
        'card': '14px',
        'input': '12px',
        'btn': '12px',
      },
    },
  },
  plugins: [],
}
