import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { ThemeProvider, THEME_STORAGE_KEY } from './ThemeProvider';
import { ThemeChoices, ThemeToggle } from './ThemeControls';
jest.mock('@ionic/react', () => ({ IonIcon: () => null }));
let systemChange: () => void;
let systemIsDark = false;
beforeEach(() => {
  localStorage.clear(); systemIsDark = false;
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ get matches() { return systemIsDark; }, addEventListener: (_type: string, cb: () => void) => { systemChange = cb; }, removeEventListener: () => {} }) });
});
afterEach(async () => { await act(async () => { cleanup(); }); });
const show = () => render(<ThemeProvider><ThemeToggle /><ThemeChoices /></ThemeProvider>);
test('persists an explicit theme and restores it after remounting', () => {
  const view = show();
  fireEvent.click(view.getByRole('button', { name: 'Activar modo oscuro' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  view.unmount();
  const restored = show();
  expect(restored.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true');
});
test('follows system changes only when system mode is selected', () => {
  const view = show();
  act(() => { systemIsDark = true; systemChange(); });
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(view.getByRole('button', { name: 'Claro' }));
  act(() => { systemIsDark = false; systemChange(); systemIsDark = true; systemChange(); });
  expect(document.documentElement.dataset.theme).toBe('light');
});
test('synchronizes a theme change from another tab', () => {
  show();
  act(() => { localStorage.setItem(THEME_STORAGE_KEY, 'dark'); window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY })); });
  expect(document.documentElement.dataset.theme).toBe('dark');
});
