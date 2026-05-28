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
          primary: '#6d28d9',
          'primary-dark': '#5b21b6',
          'primary-light': '#8b5cf6',
          accent: '#a78bfa',
          sidebar: '#0f172a',
          'sidebar-2': '#1e293b',
          risk: '#f59e0b',
          critical: '#e11d48',
          agent: '#d946ef',
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
        glow: '0 0 24px 0 rgba(139, 92, 246, 0.25)'
      }
    }
  },
  plugins: [forms, typography]
} satisfies Config;
