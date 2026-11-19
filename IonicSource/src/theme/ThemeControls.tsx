import React from 'react';
import { IonIcon } from '@ionic/react';
import { moonOutline, sunnyOutline, desktopOutline } from 'ionicons/icons';
import { useTheme, ThemePreference } from './ThemeProvider';

export const ThemeToggle: React.FC = () => {
  const { dark, setPreference } = useTheme();
  return <button className="icon-button theme-toggle" type="button" onClick={() => setPreference(dark ? 'light' : 'dark')} aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} title={dark ? 'Activar modo claro' : 'Activar modo oscuro'}><IonIcon icon={dark ? sunnyOutline : moonOutline} /></button>;
};
export const ThemeChoices: React.FC = () => {
  const { preference, setPreference } = useTheme();
  const choices: { value: ThemePreference; label: string; icon: string }[] = [{ value: 'light', label: 'Claro', icon: sunnyOutline }, { value: 'dark', label: 'Oscuro', icon: moonOutline }, { value: 'system', label: 'Sistema', icon: desktopOutline }];
  return <div className="theme-choices" role="group" aria-label="Apariencia de la aplicación">{choices.map(choice => <button key={choice.value} type="button" aria-pressed={preference === choice.value} onClick={() => setPreference(choice.value)}><IonIcon icon={choice.icon} />{choice.label}</button>)}</div>;
};
