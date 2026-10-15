/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#002f23",
        "primary-container": "#174638",
        "on-primary": "#ffffff",
        secondary: "#1d6b4b",
        "secondary-container": "#a7f3ca",
        "on-secondary-container": "#257151",
        surface: "#effdf3",
        "surface-container": "#e3f1e7",
        "surface-container-low": "#e9f7ed",
        "surface-container-high": "#deece2",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#121e18",
        "on-surface-variant": "#404945",
        outline: "#717974",
        "outline-variant": "#c0c8c3",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a"
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
