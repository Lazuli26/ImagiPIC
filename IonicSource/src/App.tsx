import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { ellipse, square, triangle } from 'ionicons/icons';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { Tab1 } from './pages/Tab1';
import Tab2 from './pages/Tab2';
import Tab3 from './pages/Tab3';

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

import firebase from 'firebase/compat/app';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';


// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";

import { getAuth, signInWithPopup, GoogleAuthProvider, User, signInWithRedirect, getRedirectResult, onAuthStateChanged, OAuthCredential, UserCredential } from "firebase/auth";

// eslint-disable-next-line import/no-webpack-loader-syntax
import Worker from "worker-loader!./assets/libraries/GeoWorker"

const worker = new Worker();

worker.postMessage({ a: 1 });
worker.onmessage = (event) => {};

worker.addEventListener("message", (event) => {});

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5R-oLq_dgzWKyTiFjgWrCEZW2uVc8baU",
  authDomain: "imagipic.firebaseapp.com",
  databaseURL: "https://imagipic.firebaseio.com",
  projectId: "imagipic",
  storageBucket: "imagipic.appspot.com",
  messagingSenderId: "830516369521",
  appId: "1:830516369521:web:5a6076068c0fd37fc9a3d0",
  measurementId: "G-B61EKG43BR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const provider = new GoogleAuthProvider();
provider.addScope(
  'https://www.googleapis.com/auth/contacts.readonly')

provider.addScope(
  'https://www.googleapis.com/auth/user.birthday.read')

const auth = getAuth();

export const AuthContext = createContext(auth)
export const UserAuthContext = createContext<{ user: User, idToken: string } | null>(null)


// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(auth);

//#endregion
//@ts-ignore
const App: React.FC = props => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string>()

  //#region Firebase UI React
  const firebaseUiConfig: firebaseui.auth.Config = useMemo(() => ({
    callbacks:
    {
      signInSuccessWithAuthResult: (authResult: any, redirectUrl: any) => {
        var user: User = authResult.user;
        var credential:OAuthCredential = authResult.credential;
        var isNewUser = authResult.additionalUserInfo.isNewUser;
        var providerId = authResult.additionalUserInfo.providerId;
        var operationType = authResult.operationType;


        switch (providerId) {
          case GoogleAuthProvider.PROVIDER_ID:
            // const credential = GoogleAuthProvider.credentialFromResult(authResult)
            setUser(user)
            setIdToken(credential.idToken)
            if (credential.accessToken) {
              localStorage.setItem("sessionAccessToken", credential.accessToken)
            }
            break;

          default:
            break;
        }
        // Do something with the returned AuthResult.
        // Return type determines whether we continue the redirect
        // automatically or whether we leave that to developer to handle.
        return true;
      }
    }

    ,
    // signInSuccessUrl: '<url-to-redirect-to-on-success>',
    signInOptions: [{
      provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      scopes: [
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/user.birthday.read'
      ]
    }
      // Leave the lines as is for the providers you want to offer your users.
      ,
    //firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    //firebase.auth.TwitterAuthProvider.PROVIDER_ID,
    //firebase.auth.GithubAuthProvider.PROVIDER_ID,
    //firebase.auth.EmailAuthProvider.PROVIDER_ID,
    //firebase.auth.PhoneAuthProvider.PROVIDER_ID,
    firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
    ],
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
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/firebase.User
        user.getIdToken().then(idToken => {
          setUser(user)
          setIdToken(idToken)
        })
      }
      else
      // The start method will wait until the DOM is loaded.`
      ui.start('#firebaseui-auth-container', firebaseUiConfig);
    })
  }, [firebaseUiConfig])

  return user && idToken ? <UserAuthContext.Provider value={{ user: user, idToken: idToken }}><IonApp>
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route path="/tab1" component={Tab1} exact={true} />
          <Route path="/tab2" component={Tab2} exact={true} />
          <Route path="/tab3" component={Tab3} />
          <Route path="/" render={() => <Redirect to="/tab1" />} exact={true} />
        </IonRouterOutlet>
        <IonTabBar slot="bottom">
          <IonTabButton tab="tab1" href="/tab1">
            <IonIcon icon={triangle} />
            <IonLabel>Tab 1</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab2" href="/tab2">
            <IonIcon icon={ellipse} />
            <IonLabel>Tab 2</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab3" href="/tab3">
            <IonIcon icon={square} />
            <IonLabel>Tab 3</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  </IonApp>
  </UserAuthContext.Provider> : <div id="firebaseui-auth-container" />
}

export default App;