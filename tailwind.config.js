/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary': '#1a202c', // Um tom de preto/cinza escuro
        'secondary': '#2d3748', // Um azul mais escuro
        'accent': '#4a5568', // Um cinza azulado para detalhes
      },
    },
  },
  plugins: [],
};