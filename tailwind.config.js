/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
    screens: {
      sm: '320px',   // Small phone
      md: '480px',   // Large phone
      lg: '768px',   // Tablet
      xl: '1024px',  // Small laptop
    },
  },
  plugins: [],
}