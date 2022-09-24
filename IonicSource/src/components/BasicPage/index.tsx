import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { signOut } from "firebase/auth";
import React, { ReactNode, useContext } from 'react';
import { AuthContext } from '../../App';
import { langs } from '../../lang';
import { useAppSelector } from '../../reducers';
import './index.scss';

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
