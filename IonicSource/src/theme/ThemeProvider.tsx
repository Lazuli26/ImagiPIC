import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'imagipic.theme';
export function readThemePreference(): ThemePreference {
  try { const saved = localStorage.getItem(THEME_STORAGE_KEY); return saved === 'light' || saved === 'dark' ? saved : 'system'; }
  catch { return 'system'; }
}
function prefersDark() { return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches; }
const ThemeContext = createContext({ preference: 'system' as ThemePreference, dark: false, setPreference: (_theme: ThemePreference) => {} });
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [systemDark, setSystemDark] = useState(prefersDark);
  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update();
    if (media.addEventListener) media.addEventListener('change', update); else media.addListener(update);
    return () => { if (media.removeEventListener) media.removeEventListener('change', update); else media.removeListener(update); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131725' : '#f2f5fb');
  }, [dark]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY || event.key == null) setPreferenceState(readThemePreference()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Theme still works without storage. */ }
  };
  return <ThemeContext.Provider value={{ preference, dark, setPreference }}>{children}</ThemeContext.Provider>;
};
