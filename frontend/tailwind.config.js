/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0c10',
        cream: '#f4efe7',
        sand: '#d7c7ad',
        gold: '#c79b45',
        emerald: '#2f8f83'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(199,155,69,0.18), 0 20px 80px rgba(0,0,0,0.35)'
      },
      fontFamily: {
        latin: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        arabic: ['"Tajawal"', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: []
};
