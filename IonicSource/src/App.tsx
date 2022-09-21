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
import React, { createContext, useState } from 'react';
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

import { getAuth, signInWithPopup, GoogleAuthProvider, User, signInWithRedirect, getRedirectResult, onAuthStateChanged } from "firebase/auth";

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

const auth = getAuth();

export const AuthContext = createContext(auth)

//@ts-ignore
const App: React.FC = props => {
  const [user, setUser] = useState<User | null>(null);
  const [userToken, setUserToken] = useState<string>()



  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in, see docs for a list of available properties
      // https://firebase.google.com/docs/reference/js/firebase.User
      user.getIdToken().then(idToken => {

        const credential = GoogleAuthProvider.credential(idToken)
        const token = credential.accessToken;

        setUser(user)
        setUserToken(token)
      })
    } else {
      // User is signed out
      /*With redirect*/
      getRedirectResult(auth).then(result => {
        if (!result) {
          signInWithRedirect(auth, provider);
        }
        else {
          const credential = GoogleAuthProvider.credentialFromResult(result);

          if (credential) {

            // This is the signed-in user
            const user = result.user;
            // This gives you a Google Access Token.
            const token = credential.accessToken;

            setUser(user)
            setUserToken(token)

            console.log(user, token)
          }
        }
      });

      /* With popup
        signInWithPopup(auth, provider)
        .then((result) => {
          // This gives you a Google Access Token. You can use it to access the Google API.
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential) {
            const token = credential.accessToken;
            // The signed-in user info.
            const user = result.user;
            setUser(user)
            setUserToken(token)
          }
          // ...
        }).catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          // The email of the user's account used.
          const email = error.customData.email;
          // The AuthCredential type that was used.
          const credential = GoogleAuthProvider.credentialFromError(error);
          // ...
        });
      */
    }
  });


  return user ? <IonApp>
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
  </IonApp> : "Logging in..."
}

export default App;