const theme = require('./src/theme.js');

module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './app/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
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
