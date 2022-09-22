import React, { useContext } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import ExploreContainer from '../components/ExploreContainer';
import './Tab2.css';
import { UserAuthContext } from '../App';
import BasicPage from '../components/BasicPage';

const Tab2: React.FC = () => {
  const userInfo = useContext(UserAuthContext);
  return (
    <BasicPage title="Tab 2">
      {JSON.stringify(userInfo)}
    </BasicPage>
  );
};

export default Tab2;
