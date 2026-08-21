/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fafafa',
          100: '#f4f4f5',
          500: '#71717a',
          600: '#ffffff', // Primary accent is now white
          700: '#e4e4e7',
        },
      },
    },
  },
  plugins: [],
};
