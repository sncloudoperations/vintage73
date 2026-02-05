/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
         primary: 'var(--primary)',
         'primary-dark': 'var(--primary-dark)',
         'primary-light': 'var(--primary-light)',
      }
    },
  },
  plugins: [],
}
