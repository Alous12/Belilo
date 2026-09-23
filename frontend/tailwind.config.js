/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        leatherGreen: {
          950: '#07120e',
          900: '#0e1f18',
          800: '#173026',
          700: '#234638',
        },
        roseGold: {
          400: '#e0a996',
          500: '#c58b75',
          600: '#aa6e57',
          700: '#8e543e',
        },
      },
      fontFamily: {
        serif: ['Cinzel', 'serif'],
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
