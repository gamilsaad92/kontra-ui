module.exports = {
  darkMode: "class",
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FDECEC',
          100: '#FAD2D3',
          200: '#F5A9AB',
          300: '#EF7C7F',
          400: '#E9585B',
          500: '#E5484D',
          600: '#C93A3F',
          700: '#A52E32',
          800: '#7A2225',
          900: '#4F1518',
        },
        ai: {
          purple:      '#7C5CFF',
          'purple-soft':'#F3F0FF',
        },
        sidebar: {
          DEFAULT: '#0B0F19',
          active:  '#161B27',
        },
        surface: {
          app:  '#F8FAFC',
          card: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
