import React, { ReactNode, useContext } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './index.scss'; import { getAuth, signOut } from "firebase/auth";
import { AuthContext } from '../../App';
import { useAppSelector } from '../../reducers';
import { langs } from '../../lang';

interface BasicPageProps {
  title: ReactNode,
  fullscreen?: boolean
}
const BasicPage: React.FC<BasicPageProps> = ({ children, title, fullscreen = true }) => {
  const auth = useContext(AuthContext);
  const lang = useAppSelector(store => store.Language.current)


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}
            <IonButton color="secondary" style={{float: "right"}} children={langs[lang].session.sign_out} onClick={() => {
              signOut(auth).then(() => {
                // Sign-out successful.

                window.location.href = "/";
              }).catch((error) => {
                // An error happened.
              });
            }} /></IonTitle>

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
