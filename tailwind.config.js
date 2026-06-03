/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F97316',
          dark: '#C2410C',
          light: '#FED7AA',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        cream: '#FFFBF5',
        ink: '#1A1410',
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        body: ['Inter_400Regular', 'System'],
        'body-medium': ['Inter_500Medium', 'System'],
        'body-semibold': ['Inter_600SemiBold', 'System'],
        'body-bold': ['Inter_700Bold', 'System'],
        'body-extrabold': ['Inter_800ExtraBold', 'System'],
        display: ['Fredoka_600SemiBold', 'System'],
        'display-bold': ['Fredoka_700Bold', 'System'],
        'display-medium': ['Fredoka_500Medium', 'System'],
      },
    },
  },
  plugins: [],
};
