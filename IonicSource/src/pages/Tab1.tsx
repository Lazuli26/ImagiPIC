import React from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import ExploreContainer from '../components/ExploreContainer';
import './Tab1.css';

const Tab1: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ImagiPIC</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">ImagiPIC App</IonTitle>
          </IonToolbar>
        </IonHeader>
        <ExploreContainer name="Here we will do ImagiPIC" />
      </IonContent>
    </IonPage>
  );
};

export default Tab1;
