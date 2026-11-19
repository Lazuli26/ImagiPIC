import { signInAnonymously, updateProfile } from 'firebase/auth';
import { auth, signInAsGuest } from './auth';

jest.mock('./firebaseApp', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ signInAnonymously: jest.fn(), updateProfile: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); (auth as any).currentUser = null; });

test.each(['', '   ', 'a'.repeat(31)])('rejects invalid guest names before authenticating: %p', async name => {
  await expect(signInAsGuest(name)).rejects.toThrow('nombre de usuario');
  expect(signInAnonymously).not.toHaveBeenCalled();
  expect(updateProfile).not.toHaveBeenCalled();
});

test('accepts the same display name for distinct Firebase accounts', async () => {
  const first = { uid: 'first', isAnonymous: true };
  const second = { uid: 'second', isAnonymous: true };
  (signInAnonymously as jest.Mock).mockResolvedValueOnce({ user: first }).mockResolvedValueOnce({ user: second });
  await expect(signInAsGuest('Estrella')).resolves.toBe(first);
  await expect(signInAsGuest('Estrella')).resolves.toBe(second);
  expect(updateProfile).toHaveBeenNthCalledWith(1, first, { displayName: 'Estrella' });
  expect(updateProfile).toHaveBeenNthCalledWith(2, second, { displayName: 'Estrella' });
});

test('does not overwrite an existing registered account', async () => {
  (auth as any).currentUser = { uid: 'registered', isAnonymous: false };
  await expect(signInAsGuest('Estrella')).rejects.toThrow('sesión iniciada');
  expect(updateProfile).not.toHaveBeenCalled();
});
