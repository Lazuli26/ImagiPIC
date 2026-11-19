import { getAnalytics } from "firebase/analytics";
import { initializeApp, FirebaseApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  Firestore,
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyC5R-oLq_dgzWKyTiFjgWrCEZW2uVc8baU",
  authDomain: "imagipic.firebaseapp.com",
  databaseURL: "https://imagipic.firebaseio.com",
  projectId: "imagipic",
  storageBucket: "imagipic.appspot.com",
  messagingSenderId: "830516369521",
  appId: "1:830516369521:web:5a6076068c0fd37fc9a3d0",
  measurementId: "G-B61EKG43BR",
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const analytics = getAnalytics(firebaseApp);

export const auth: Auth = getAuth(firebaseApp);

export const db: Firestore = getFirestore(firebaseApp);

enableMultiTabIndexedDbPersistence(db).catch(() => void 0);
