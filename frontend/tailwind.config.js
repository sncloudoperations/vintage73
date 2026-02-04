/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
         primary: '#10b981',
         'primary-dark': '#059669',
      }
    },
  },
  plugins: [],
}
