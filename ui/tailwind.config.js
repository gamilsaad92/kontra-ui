import theme from './src/theme.js';

export default {
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
