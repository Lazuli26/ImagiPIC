import React, { ReactNode, useContext } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './index.scss'; import { getAuth, signOut } from "firebase/auth";
import { AuthContext } from '../../App';

interface BasicPageProps {
  title: ReactNode,
  fullscreen?: boolean
}
const BasicPage: React.FC<BasicPageProps> = ({ children, title, fullscreen = true }) => {
  const auth = useContext(AuthContext);
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButton onClick={() => {
            signOut(auth).then(() => {
              // Sign-out successful.
            }).catch((error) => {
              // An error happened.
            });
          }} />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={fullscreen}>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
        {children}
      </IonContent>
    </IonPage>
  );
};

export default BasicPage;
