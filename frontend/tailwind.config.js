/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg':        '#0d1117',
        'surface':   '#161b22',
        'border':    '#30363d',
        'txt':       '#e6edf3',
        'txt2':      '#7d8590',
        'success':   '#238636',
        'danger':    '#b22222',
        'accent':    '#1f6feb',
        'pending':   '#9e6a03',
        'danger-bg': '#6e1313',
        'success-bg':'#0f3d1a',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
}
