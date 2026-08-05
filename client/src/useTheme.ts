import { createContext, useContext, useEffect, useState } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'diff-reviewer-theme';

// 解決済みテーマ（light/dark）を配下コンポーネントへ配る
export const ThemeContext = createContext<ResolvedTheme>('light');

export function useResolvedTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}

export function useTheme(): {
  pref: ThemePref;
  resolved: ResolvedTheme;
  cycle: () => void;
} {
  const [pref, setPref] = useState<ThemePref>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  });
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref);
    // auto のときは属性を外してメディアクエリに委ねる
    if (pref === 'auto') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = pref;
    }
  }, [pref]);

  const resolved: ResolvedTheme = pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;

  const cycle = () =>
    setPref((p) => (p === 'auto' ? 'light' : p === 'light' ? 'dark' : 'auto'));

  return { pref, resolved, cycle };
}
