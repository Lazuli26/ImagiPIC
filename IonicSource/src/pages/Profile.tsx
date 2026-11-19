import { IonButton, IonIcon } from '@ionic/react';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { mailOutline, logoGoogle, imagesOutline, logOutOutline, arrowForwardOutline } from 'ionicons/icons';
import React, { useContext, useState } from 'react';
import BasicPage from '../components/BasicPage';
import { UserAuthContext } from '../App';
import { useDeck } from '../game/useDeck';
import { signOutUser } from '../firebase/auth';
import { ThemeChoices } from '../theme/ThemeControls';

const Profile: React.FC = () => {
  const user = useContext(UserAuthContext)?.user;
  const { meta, images } = useDeck(user?.uid || '');
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const googleLinked = linked || !!user?.providerData.some(provider => provider.providerId === GoogleAuthProvider.PROVIDER_ID);
  const isGuest = !!user?.isAnonymous && !googleLinked;
  const handleLinkGoogle = async () => {
    if (!user || linking) return;
    setLinking(true); setLinkError('');
    try { const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); await linkWithPopup(user, provider); setLinked(true); }
    catch (error) {
      const messages: Record<string, string> = {
        'auth/credential-already-in-use': 'Esta cuenta de Google pertenece a otra cuenta de ImagiPIC. Elige otra cuenta de Google. Tus cuentas no se han fusionado.',
        'auth/email-already-in-use': 'Este correo pertenece a otra cuenta de ImagiPIC. Inicia sesión en esa cuenta para gestionar sus métodos de acceso.',
        'auth/popup-blocked': 'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.',
        'auth/popup-closed-by-user': 'Se canceló la vinculación. Puedes intentarlo de nuevo.',
        'auth/cancelled-popup-request': 'Se canceló la vinculación. Puedes intentarlo de nuevo.',
        'auth/requires-recent-login': 'Cierra sesión y vuelve a entrar antes de vincular Google.',
        'auth/network-request-failed': 'Comprueba tu conexión e inténtalo de nuevo.',
      };
      const code = (error as { code?: string }).code || '';
      if (code === 'auth/provider-already-linked') setLinked(true);
      else setLinkError(messages[code] || 'No se pudo vincular Google. Inténtalo de nuevo.');
    } finally { setLinking(false); }
  };
  const handleSignOut = async () => {
    setSigningOut(true); setSignOutError('');
    try { await signOutUser(); }
    catch { setSignOutError('No se pudo cerrar sesión. Inténtalo de nuevo.'); setSigningOut(false); }
  };
  if (!user) return <BasicPage title="Mi perfil"><div className="page-shell">Cargando tu perfil…</div></BasicPage>;
  const count = meta?.count ?? images?.length ?? 0;
  return <BasicPage title="Mi perfil"><div className="page-shell">
    <div className="page-heading"><div><span className="page-eyebrow">TU RINCÓN CREATIVO</span><h1>Así juegas tú.</h1><p>Tu cuenta, tus imágenes y los pequeños detalles que hacen tuyo este espacio.</p></div></div>
    <div className="profile-layout">
      <section className="surface-card profile-identity"><div className="profile-avatar">{user.photoURL ? <img src={user.photoURL} alt="Tu foto de perfil" /> : (user.displayName || 'J')[0].toUpperCase()}</div><h2>{user.displayName || 'Mente curiosa'}</h2><p className="profile-email">{isGuest ? 'Cuenta de invitado' : user.email}</p><div className="profile-deck-count"><strong>{count}<small>de 50</small></strong><div><strong>Imágenes en tu mazo</strong><small>Ideas listas para tu próxima partida.</small></div></div><IonButton expand="block" fill="outline" routerLink="/deck"><IonIcon slot="start" icon={imagesOutline} />Explorar mi mazo<IonIcon slot="end" icon={arrowForwardOutline} /></IonButton></section>
      <div className="profile-column">
        <section className="surface-card"><span className="page-eyebrow">A TU GUSTO</span><h2 style={{ marginTop: 10 }}>Una luz para cada momento.</h2><p>Elige la apariencia o deja que siga el tema de tu dispositivo.</p><ThemeChoices /></section>
        <section className="surface-card"><h2>Una cuenta. Todas tus ideas.</h2><p>Elige cómo entrar a tu cuenta sin perder tus imágenes.</p>
          {isGuest && <p>Tu cuenta de invitado es temporal y puede eliminarse a partir de los 30 días. Vincula Google para conservar tu cuenta y tu mazo.</p>}
          {user.providerData.some(provider => provider.providerId === 'password') && <div className="account-method"><IonIcon icon={mailOutline} /><div><strong>Correo y contraseña</strong><small>{user.email}</small></div><span className="account-status">Activo</span></div>}
          <div className="account-method"><IonIcon icon={logoGoogle} /><div><strong>Google</strong><small>{googleLinked ? 'Vinculado a esta misma cuenta.' : 'Otra forma de entrar a tu espacio.'}</small></div>{googleLinked && <span className="account-status">Activo</span>}</div>
          {googleLinked ? <p role="status">Google vinculado. Puedes entrar con Google y conservar esta misma cuenta y tu mazo.</p> : <><p>Al vincular Google conservarás tu cuenta y tu mazo. No solicitamos acceso a Gmail, Drive ni contactos.</p><IonButton fill="outline" disabled={linking} onClick={handleLinkGoogle}>{linking ? 'Vinculando…' : 'Vincular cuenta de Google'}</IonButton></>}
          {linkError && <p role="alert" className="account-error">{linkError}</p>}
        </section>
        <section className="profile-signout"><p>{isGuest ? 'Si cierras sesión como invitado, no podrás recuperar esta cuenta ni su mazo. Vincula Google antes de salir para conservarlos.' : 'Tu mazo se queda aquí, listo para cuando vuelvas.'}</p><IonButton fill="clear" color="medium" disabled={signingOut} onClick={handleSignOut}><IonIcon slot="start" icon={logOutOutline} />{signingOut ? 'Saliendo…' : 'Cerrar sesión'}</IonButton></section>{signOutError && <p role="alert" className="account-error">{signOutError}</p>}
      </div>
    </div>
  </div></BasicPage>;
};
export { Profile };
export default Profile;
