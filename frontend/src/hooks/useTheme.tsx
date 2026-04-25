import React, { createContext, useContext, useState, useEffect } from 'react';
import { TOKENS, Theme, ThemeMode } from '../tokens';

interface ThemeContextValue {
  mode: ThemeMode;
  t: Theme;
  toggle(): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggle = () => setMode(m => m === 'light' ? 'dark' : 'light');
  const t = TOKENS[mode];

  return (
    <ThemeContext.Provider value={{ mode, t, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
