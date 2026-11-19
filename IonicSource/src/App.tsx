import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import Home from './pages/Home';
import Deck from './pages/Deck';
import Profile from './pages/Profile';
import RoomContainer from './pages/Room';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/display.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';

/* Theme variables */
import './theme/variables.css';
import './pages/Home.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { ThemeToggle } from './theme/ThemeControls';
import Logo from './components/brand/Logo';
import GeometryBackdrop from './components/brand/GeometryBackdrop';
import ShapeShowcase from './components/showcase/ShapeShowcase';
import GuestSignIn from './components/GuestSignIn';

import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';

import { EmailAuthProvider, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth } from './firebase/auth';
import { db } from './firebase/firebaseApp';

setupIonicReact({
  mode: 'md'
});

export const AuthContext = createContext(auth)
export const UserAuthContext = createContext<{ user: User, idToken: string } | null>(null)


// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(auth);

//#endregion
//@ts-ignore
const TabShell: React.FC = () => {
  return (
    <IonRouterOutlet>
      <Route path="/home" component={Home} exact={true} />
      <Route path="/deck" component={Deck} exact={true} />
      <Route path="/profile" component={Profile} exact={true} />
      <Route path="/" render={() => <Redirect to="/home" />} exact={true} />
    </IonRouterOutlet>
  );
};

//@ts-ignore
const AppContent: React.FC = () => {
  // A new wrapper also renders profile changes: Firebase mutates its User
  // instance when updateProfile completes without another auth-state event.
  const [session, setSession] = useState<{ user: User } | null>(null);
  const user = session?.user || null;
  const needsGuestName = !!user?.isAnonymous && !user.displayName?.trim();
  const [idToken, setIdToken] = useState<string>()
  const [authResolved, setAuthResolved] = useState(false);

  //#region Firebase UI React
  const firebaseUiConfig: firebaseui.auth.Config = useMemo(() => ({
    callbacks:
    {
      signInSuccessWithAuthResult: () => {
        // onAuthStateChanged supplies the Firebase user and ID token.
        // Google API access tokens are unnecessary for signing into ImagiPIC.
        // Do something with the returned AuthResult.
        // Return type determines whether we continue the redirect
        // automatically or whether we leave that to developer to handle.
        return false;
      }
    }

    ,
    // signInSuccessUrl: '<url-to-redirect-to-on-success>',
    signInOptions: [
      {
        provider: EmailAuthProvider.PROVIDER_ID,
        signInMethod: EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD,
        requireDisplayName: true,
      },
      {
        provider: GoogleAuthProvider.PROVIDER_ID,
        // No additional Google API permissions are needed.
        scopes: [],
      },
    ],
    // signInFlow='popup' skips the OAuth redirect round-trip through
    // authDomain (imagipic.firebaseapp.com/__/auth/handler) entirely.
    // Without this, some Chrome-extension Content Security Policies block
    // blob:// script injection that Firebase's handler page uses to hand
    // the OAuth credential back to the localhost app → user appears
    // signed-out after Google's redirect → auth widget re-renders → loop.
    signInFlow: 'popup',
    // tosUrl and privacyPolicyUrl accept either url string or a callback
    // function.
    // Terms of service url/callback.
    tosUrl: '<your-tos-url>',
    // Privacy policy url/callback.
    privacyPolicyUrl: function () {
      window.location.assign('<your-privacy-policy-url>');
    }
  }), []);


  useEffect(() => {
    // Remove unused Google API tokens saved by earlier versions.
    localStorage.removeItem('sessionAccessToken');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthResolved(true);
      if (user) {
        // Render the signed-in app as soon as Firebase restores the session.
        // Token refresh and profile synchronization can finish in the background.
        setSession({ user });
        setIdToken(undefined);
        user.getIdToken().then(token => {
          if (auth.currentUser?.uid === user.uid) setIdToken(token);
        }).catch(() => void 0);
      } else {
        // Signed out: reset local auth state so any prior user/token
        // doesn't linger and cause a false "signed in" render.
        setSession(null);
        setIdToken(undefined);

      }
    });
    return () => {
      unsubscribe();
    };
  }, [firebaseUiConfig])

  useEffect(() => {
    if (!session || needsGuestName) return;
    const { user } = session;
    const syncProfile = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);
        if (auth.currentUser?.uid !== user.uid) return;
        await setDoc(userDocRef, {
          uid: user.uid,
          displayName: user.displayName || 'Jugador',
          photoURL: user.photoURL || '',
          email: user.email || '',
          ...(!snap.exists() ? { createdAt: serverTimestamp() } : {}),
          lastSeenAt: serverTimestamp(),
        }, { merge: true });
      } catch (_error) {
        // Profile synchronization is best effort; playing does not wait on it.
      }
    };
    syncProfile();
  }, [session, needsGuestName]);

  // Mount the widget only after React has rendered its container, including
  // when returning to sign-in after signing out.
  useEffect(() => {
    if (!authResolved || user) return;
    ui.start('#firebaseui-auth-container', firebaseUiConfig);
    return () => {
      ui.reset();
    };
  }, [authResolved, user, firebaseUiConfig]);

  return !authResolved ? <IonApp><main className="auth-loading" role="status" aria-label="Comprobando sesión"><Logo /><p>Comprobando tu sesión…</p></main></IonApp> : user && !needsGuestName ? <UserAuthContext.Provider value={{ user, idToken: idToken || '' }}><IonApp>
    <IonReactRouter>
      <Switch>
        <Route path="/room/:code" component={RoomContainer} exact={true} />
        <Route path="/" component={TabShell} />
      </Switch>
    </IonReactRouter>
  </IonApp>
  </UserAuthContext.Provider> : <IonApp><main className="guest-page">
    <GeometryBackdrop />
    <header className="guest-header"><Logo /><ThemeToggle /></header>
    <div className="home-shell"><section className="home-hero">
      <div className="home-copy"><span className="page-eyebrow">BIENVENIDO A IMAGIPIC</span>
        <h1>Tu próxima idea<br />empieza <span>aquí<svg viewBox="0 0 300 16" aria-hidden="true"><path d="M3 11Q150-5 297 9" /></svg></span>.</h1>
        <p>Adivina imágenes que cobran vida forma a forma. Reúne a tus amigos, cambia de perspectiva y descubre quién tiene mejor ojo.</p>
        <div className="signin-panel">
          <GuestSignIn needsName={needsGuestName} onComplete={user => { if (auth.currentUser?.uid === user.uid) setSession({ user }); }} />
          {!user && <><p className="signin-divider">O entra con tu cuenta</p><div id="firebaseui-auth-container" /></>}
        </div>
        <details className="signin-privacy"><summary>Tu cuenta, tus imágenes</summary><p>Puedes jugar como invitado con un nombre de usuario, o iniciar sesión con correo o Google para conservar tu cuenta y tu mazo. Google comparte tu nombre, correo y foto de perfil para identificarte. No solicitamos acceso a Gmail, Drive ni contactos.</p></details>
        <div className="home-footnote"><span className="friends-symbol" aria-hidden="true">○ △ □</span><span>Una sala, tus amigos y muchas ideas.<br /><strong>De 2 a 12 personas · Sin descargar nada</strong></span></div>
      </div><div className="home-art-pane"><ShapeShowcase /></div>
    </section></div>
  </main></IonApp>
}

const App: React.FC = () => <ThemeProvider><AppContent /></ThemeProvider>;
export default App;
