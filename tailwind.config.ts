import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        grc: {
          primary: '#047857',
          'primary-dark': '#065f46',
          'primary-light': '#10b981',
          accent: '#34d399',
          sidebar: '#0f172a',
          'sidebar-2': '#1e293b',
          risk: '#f59e0b',
          critical: '#e11d48',
          agent: '#a855f7',
          ink: '#0f172a'
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          sunken: '#f1f5f9'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 4px 0 rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 14px 0 rgba(15, 23, 42, 0.08)',
        glow: '0 0 24px 0 rgba(16, 185, 129, 0.25)'
      }
    }
  },
  plugins: [forms, typography]
} satisfies Config;
