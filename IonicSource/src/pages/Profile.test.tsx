import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import Profile from './Profile';
import { UserAuthContext } from '../App';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';

jest.mock('../App', () => ({ UserAuthContext: require('react').createContext(null) }));
jest.mock('../game/useDeck', () => ({ useDeck: () => ({ meta: null }) }));
jest.mock('../firebase/auth', () => ({ signOutUser: jest.fn() }));
jest.mock('../components/BasicPage', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('@ionic/react', () => {
  const React = require('react');
  const component = ({ children }: any) => React.createElement('div', null, children);
  return {
    IonAvatar: component, IonCard: component, IonCardContent: component,
    IonCardHeader: component, IonCardSubtitle: component, IonCardTitle: component,
    IonCol: component, IonContent: component, IonGrid: component, IonRow: component,
    IonText: component, IonIcon: component,
    IonButton: ({ children, onClick, disabled }: any) => React.createElement('button', { onClick, disabled }, children),
  };
});
jest.mock('firebase/auth', () => {
  const GoogleAuthProvider = jest.fn(() => ({ setCustomParameters: jest.fn() }));
  (GoogleAuthProvider as any).PROVIDER_ID = 'google.com';
  return { GoogleAuthProvider, linkWithPopup: jest.fn() };
});
const user = { uid: 'existing-user', email: 'player@example.com', providerData: [{ providerId: 'password' }] };
const showProfile = (account = user) => render(
  <UserAuthContext.Provider value={{ user: account as any, idToken: 'firebase-token' }}><Profile /></UserAuthContext.Provider>
);
beforeEach(() => {
  jest.clearAllMocks();
  (GoogleAuthProvider as unknown as jest.Mock).mockImplementation(() => ({ setCustomParameters: jest.fn() }));
});
test('links Google to the existing user', async () => {
  (linkWithPopup as jest.Mock).mockResolvedValue({ user });
  const view = showProfile();
  await act(async () => { fireEvent.click(view.getByText('Vincular cuenta de Google')); });
  expect(view.getByRole('status')).toBeTruthy();
  expect(linkWithPopup).toHaveBeenCalledWith(user, expect.any(Object));
  expect(view.queryByText('Vincular cuenta de Google')).toBeNull();
});
test('preserves the account when Google belongs to another user', async () => {
  (linkWithPopup as jest.Mock).mockRejectedValue({ code: 'auth/credential-already-in-use' });
  const view = showProfile();
  await act(async () => { fireEvent.click(view.getByText('Vincular cuenta de Google')); });
  const alert = view.getByRole('alert');
  expect(alert.textContent).toContain('Tus cuentas no se han fusionado');
  expect((view.getByText('Vincular cuenta de Google') as HTMLButtonElement).disabled).toBe(false);
});
test('shows an already linked Google provider', () => {
  const view = showProfile({ ...user, providerData: [{ providerId: 'google.com' }] });
  expect(view.getByRole('status')).toBeTruthy();
  expect(view.queryByText('Vincular cuenta de Google')).toBeNull();
});

test('explains guest account expiry and loss of access on sign-out', () => {
  const view = showProfile({ ...user, isAnonymous: true, providerData: [], email: null } as any);
  expect(view.getByText('Cuenta de invitado')).toBeTruthy();
  expect(view.getByText(/puede eliminarse a partir de los 30 días/)).toBeTruthy();
  expect(view.getByText(/no podrás recuperar esta cuenta ni su mazo/)).toBeTruthy();
});

test('upgrades a guest with Google and removes the temporary account notices', async () => {
  const guest = { ...user, isAnonymous: true, providerData: [], email: null };
  (linkWithPopup as jest.Mock).mockResolvedValue({ user: guest });
  const view = showProfile(guest as any);
  await act(async () => { fireEvent.click(view.getByText('Vincular cuenta de Google')); });
  expect(linkWithPopup).toHaveBeenCalledWith(guest, expect.any(Object));
  expect(view.getByRole('status')).toBeTruthy();
  expect(view.queryByText('Cuenta de invitado')).toBeNull();
  expect(view.queryByText(/puede eliminarse a partir de los 30 días/)).toBeNull();
});
