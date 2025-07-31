import { colors, spacing, typography } from './src/theme.js';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        background: colors.background,
        surface: colors.surface
      },
      spacing,
      fontSize: typography
    }
  }
};
