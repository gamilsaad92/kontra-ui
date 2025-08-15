const theme = require('./src/theme.js');

module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: theme.colors,
      spacing: theme.spacing,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
  },
  plugins: [],
}
