/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      height: {
        '114': '114px',
        '660': '660px',
        '570': '570px',
      },
      maxHeight: {
        '660': '660px',
        '570': '570px',
      },
      width: {
        '1230': '1230px',
        '180': '180px',
        '100': '100px',
      },
      maxWidth: {
        '1230': '1230px',
        '180': '180px',
      },
      padding: {
        '12': '3rem', // Matches 1.5rem + 1.5rem
      },
      borderRadius: {
        'custom-tab': '20px 20px 0 0',
        'custom-content': '0 50px 50px 50px',
        'custom-user': '50px 50px 0 50px',
        'custom-bot': '50px 50px 50px 0',
        '30': '30px',
      },
      colors: {
        'skye-green': '#1EA974',
        'dark-blue': '#001B35',
        'light-grey': '#F2F2F2',
        grey: '#E5E5E5',
      },
      fontSize: {
        'base': '1.6rem',
        'button': '2rem',
        'xs': '1.2rem',
      },
      lineHeight: {
        '120': '120%',
      },
      boxShadow: {
        'custom': '0 10px 15px rgba(0, 0, 0, 0.25)',
      },
      transitionProperty: {
        'height': 'height',
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
