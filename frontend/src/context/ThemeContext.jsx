import { createContext, useContext, useEffect, useState } from 'react';

/**
 * ThemeContext
 *
 * Manages the light/dark theme toggle for the entire app.
 *
 * Priority order for initial theme:
 *   1. localStorage ('theme' key, 'light' | 'dark')
 *   2. OS-level preference via prefers-color-scheme media query
 *   3. Default: 'light'
 *
 * The theme is applied by adding/removing the 'dark' class on <html>.
 * Tailwind's `darkMode: 'class'` config picks this up automatically.
 * All color values live in CSS variables in index.css — components
 * use the semantic Tailwind tokens (bg-surface-1, text-tx-primary, etc.)
 * so no per-component dark: prefixes are needed.
 */

const ThemeContext = createContext(null);

function getInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply class to <html> whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
