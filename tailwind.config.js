/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./front/**/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark"],
  },
}
