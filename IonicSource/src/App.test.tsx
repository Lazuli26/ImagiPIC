import React from 'react';
import { act, fireEvent, render, cleanup } from '@testing-library/react';
import App from './App';
import * as firebaseui from 'firebaseui';
import { signInAnonymously, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from './firebase/auth';

// Exercise the real sign-in flow against a local Firebase boundary.
let mockInitialUser: any = null;
let mockAuthListener: (user: any) => void;
jest.mock('./pages/Home', () => () => <div>Home</div>);
jest.mock('./pages/Deck', () => () => <div>Deck</div>);
jest.mock('./pages/Profile', () => () => <div>Profile</div>);
jest.mock('./pages/Room', () => () => <div>Room</div>);
jest.mock('./firebase/firebaseApp', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { PROVIDER_ID: 'password', EMAIL_PASSWORD_SIGN_IN_METHOD: 'password' },
  GoogleAuthProvider: { PROVIDER_ID: 'google.com' },
  signInAnonymously: jest.fn(), updateProfile: jest.fn(), signOut: jest.fn(),
  onAuthStateChanged: (auth: any, listener: (user: any) => void) => {
    mockAuthListener = user => { auth.currentUser = user; listener(user); };
    mockAuthListener(mockInitialUser);
    return () => {};
  },
}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(async () => ({ exists: () => false })), setDoc: jest.fn(), serverTimestamp: jest.fn() }));
jest.mock('firebaseui/dist/firebaseui.css', () => ({}));
jest.mock('firebaseui', () => ({ auth: { AuthUI: class { static instance: any; start = jest.fn(); reset = jest.fn(); constructor() { (this.constructor as any).instance = this; } } } }));

const guest = (displayName: string | null = null) => ({ uid: 'guest-uid', displayName, isAnonymous: true, getIdToken: jest.fn(async () => 'guest-token') });
beforeEach(() => {
  jest.clearAllMocks();
  mockInitialUser = null;
  (auth as any).currentUser = null;
  (doc as jest.Mock).mockReturnValue({ path: 'users/guest-uid' });
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
  window.history.replaceState({}, '', '/room/TEST12');
});
afterEach(async () => { await act(async () => { cleanup(); }); });

test('shows the sign-in screen and mounts the auth widget', async () => {
  const view = render(<App />);
  expect(view.getByRole('heading', { name: /Tu próxima idea/ })).toBeTruthy();
  const widget = (firebaseui.auth.AuthUI as any).instance;
  expect(widget.start).toHaveBeenCalledWith('#firebaseui-auth-container', expect.any(Object));
  await act(async () => { cleanup(); });
  expect(widget.reset).toHaveBeenCalled();
});

test('requires a nonblank name before creating a guest account', async () => {
  const view = render(<App />);
  const button = view.getByText('Jugar como invitado') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(view.getByLabelText('Tu nombre de usuario'), { target: { value: '   ' } });
  await act(async () => { fireEvent.submit(view.getByRole('form', { name: 'Acceso como invitado' })); });
  expect(signInAnonymously).not.toHaveBeenCalled();
  expect(view.queryByText('Room')).toBeNull();
});

test('waits for the guest name to be saved, then opens the original room URL', async () => {
  const user = guest();
  let finishProfile: () => void = () => {};
  (signInAnonymously as jest.Mock).mockImplementation(async () => { mockAuthListener(user); return { user }; });
  (updateProfile as jest.Mock).mockImplementation((_user, profile) => new Promise<void>(resolve => {
    finishProfile = () => { Object.assign(user, profile); resolve(); };
  }));
  const view = render(<App />);
  fireEvent.change(view.getByLabelText('Tu nombre de usuario'), { target: { value: '  Estrella  ' } });
  await act(async () => { fireEvent.submit(view.getByRole('form', { name: 'Acceso como invitado' })); });
  expect(view.queryByText('Room')).toBeNull();
  expect(setDoc).not.toHaveBeenCalled();
  expect((view.getByText('Entrando…') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { finishProfile(); });
  expect(view.getByText('Room')).toBeTruthy();
  expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Estrella' });
  expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ uid: user.uid, displayName: 'Estrella' }), { merge: true });
});

test('restores named guest sessions without prompting again', async () => {
  mockInitialUser = guest('Estrella');
  const view = render(<App />);
  await act(async () => {});
  expect(view.getByText('Room')).toBeTruthy();
  expect(signInAnonymously).not.toHaveBeenCalled();
  expect(view.queryByLabelText('Tu nombre de usuario')).toBeNull();
});

test('keeps unnamed restored guests outside the room and retries profile failures with the same UID', async () => {
  const user = guest();
  mockInitialUser = user;
  (updateProfile as jest.Mock).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  const view = render(<App />);
  expect(view.queryByText('Room')).toBeNull();
  fireEvent.change(view.getByLabelText('Tu nombre de usuario'), { target: { value: 'Estrella' } });
  await act(async () => { fireEvent.submit(view.getByRole('form', { name: 'Acceso como invitado' })); });
  expect(view.getByRole('alert').textContent).toContain('Comprueba tu conexión');
  expect(view.queryByText('Room')).toBeNull();
  expect(setDoc).not.toHaveBeenCalled();
  (updateProfile as jest.Mock).mockImplementation(async (_user, profile) => { Object.assign(user, profile); });
  await act(async () => { fireEvent.submit(view.getByRole('form', { name: 'Acceso como invitado' })); });
  expect(view.getByText('Room')).toBeTruthy();
  expect(signInAnonymously).not.toHaveBeenCalled();
});

test('shows anonymous sign-in errors and allows trying again', async () => {
  (signInAnonymously as jest.Mock).mockRejectedValue({ code: 'auth/too-many-requests' });
  const view = render(<App />);
  fireEvent.change(view.getByLabelText('Tu nombre de usuario'), { target: { value: 'Estrella' } });
  await act(async () => { fireEvent.submit(view.getByRole('form', { name: 'Acceso como invitado' })); });
  expect(view.getByRole('alert').textContent).toContain('Hay demasiados intentos');
  expect((view.getByText('Jugar como invitado') as HTMLButtonElement).disabled).toBe(false);
});

test('restores regular accounts without a guest name prompt', async () => {
  mockInitialUser = { ...guest(), isAnonymous: false };
  const view = render(<App />);
  await act(async () => {});
  expect(view.getByText('Room')).toBeTruthy();
  expect(signInAnonymously).not.toHaveBeenCalled();
});

test('can leave an incomplete guest session and restores the other sign-in options', async () => {
  mockInitialUser = guest();
  (signOut as jest.Mock).mockImplementation(async () => { mockAuthListener(null); });
  const view = render(<App />);
  expect(document.querySelector('#firebaseui-auth-container')).toBeNull();
  await act(async () => { fireEvent.click(view.getByText('Volver a las opciones de acceso')); });
  expect(signOut).toHaveBeenCalledWith(auth);
  expect(document.querySelector('#firebaseui-auth-container')).toBeTruthy();
  expect((firebaseui.auth.AuthUI as any).instance.start).toHaveBeenCalledWith('#firebaseui-auth-container', expect.any(Object));
});
