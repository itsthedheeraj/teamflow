/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 'class' strategy: dark mode is toggled by adding/removing the 'dark'
  // class on <html>. ThemeContext controls this; CSS variables do the
  // heavy lifting so Tailwind utility classes stay thin.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand blue — same values used in both themes (accent doesn't flip)
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // ── Semantic surface tokens (backed by CSS variables) ──────────
        // Every component uses these instead of literal gray-* values.
        // The CSS variable values flip automatically when dark class is set.
        surface: {
          0: 'var(--surface-0)',   // page background
          1: 'var(--surface-1)',   // card / sidebar
          2: 'var(--surface-2)',   // elevated card / dropdown
          3: 'var(--surface-3)',   // project cards (between 1 and 2)
        },
        // ── Text tokens ──────────────────────────────────────────────
        tx: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
        },
        // ── Border tokens ─────────────────────────────────────────────
        line: {
          DEFAULT: 'var(--border)',
          strong:  'var(--border-strong)',
          dashed:  'var(--border-dashed)',
        },
        // ── Accent tokens ─────────────────────────────────────────────
        accent: {
          DEFAULT: 'var(--accent)',
          bg:      'var(--accent-bg)',
          text:    'var(--accent-text)',
        },
        // ── Status badge tokens ───────────────────────────────────────
        status: {
          'success-bg':   'var(--status-success-bg)',
          'success-text': 'var(--status-success-text)',
          'warning-bg':   'var(--status-warning-bg)',
          'warning-text': 'var(--status-warning-text)',
          'danger-bg':    'var(--status-danger-bg)',
          'danger-text':  'var(--status-danger-text)',
          'pro-bg':       'var(--status-pro-bg)',
          'pro-text':     'var(--status-pro-text)',
          'note-bg':      'var(--status-note-bg)',
          'note-text':    'var(--status-note-text)',
          'note-border':  'var(--status-note-border)',
        },
      },
    },
  },
  plugins: [],
};
