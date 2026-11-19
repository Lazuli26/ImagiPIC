import React, { useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { GUEST_NAME_MAX_LENGTH, signInAsGuest, signOutUser } from '../firebase/auth';

interface Props {
  needsName: boolean;
  onComplete: (user: User) => void;
}

const GuestSignIn: React.FC<Props> = ({ needsName, onComplete }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    if (!name.trim()) { setError('Escribe tu nombre de usuario para jugar.'); return; }
    pending.current = true;
    setBusy(true); setError('');
    try { onComplete(await signInAsGuest(name)); }
    catch (error) {
      const messages: Record<string, string> = {
        'auth/network-request-failed': 'Comprueba tu conexión e inténtalo de nuevo.',
        'auth/too-many-requests': 'Hay demasiados intentos. Espera un momento e inténtalo de nuevo.',
        'auth/operation-not-allowed': 'El acceso como invitado no está disponible en este momento.',
      };
      setError(messages[(error as { code?: string }).code || ''] || 'No se pudo entrar como invitado. Inténtalo de nuevo.');
    } finally { pending.current = false; setBusy(false); }
  };
  const cancel = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    try { await signOutUser(); }
    catch { setError('No se pudo cerrar la sesión de invitado. Inténtalo de nuevo.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <form className="guest-signin" onSubmit={submit} aria-label="Acceso como invitado">
    <label htmlFor="guest-username">Tu nombre de usuario</label>
    <input id="guest-username" name="nickname" autoComplete="nickname" maxLength={GUEST_NAME_MAX_LENGTH} required value={name} disabled={busy} onChange={event => { setName(event.target.value); setError(''); }} aria-describedby="guest-name-hint" placeholder="¿Cómo te llamas en el juego?" />
    <small id="guest-name-hint">Así te verán los demás. El nombre puede repetirse.</small>
    <button type="submit" className="guest-signin-submit" disabled={busy || !name.trim()}>{busy ? 'Entrando…' : 'Jugar como invitado'}</button>
    {error && <p className="guest-signin-error" role="alert">{error}</p>}
    {needsName && <><p>Completa tu nombre para continuar.</p><button type="button" className="guest-signin-cancel" disabled={busy} onClick={cancel}>Volver a las opciones de acceso</button></>}
    <p>Tu cuenta de invitado es temporal y puede eliminarse a partir de los 30 días. Puedes conservarla vinculando Google desde tu perfil.</p>
  </form>;
};

export default GuestSignIn;
