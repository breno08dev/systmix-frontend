/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cores personalizadas que criamos
        background: '#f8fafc',  // Slate 50
        surface: '#ffffff',     // White
        primary: '#0f172a',     // Slate 900
        secondary: '#1e293b',   // Slate 800
        accent: '#4f46e5',      // Indigo 600
        
        // Cores para texto
        'text-main': '#1e293b',
        'text-muted': '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'card': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
        'glow': '0 0 15px rgba(79, 70, 229, 0.15)',
      }
    },
  },
  plugins: [],
};