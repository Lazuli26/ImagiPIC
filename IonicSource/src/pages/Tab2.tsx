import React, { useContext } from 'react';
import { UserAuthContext } from '../App';
import BasicPage from '../components/BasicPage';
import './Tab2.css';

const Tab2: React.FC = () => {
  const userInfo = useContext(UserAuthContext);
  return (
    <BasicPage title="Tab 2">
      {JSON.stringify(userInfo)}
    </BasicPage>
  );
};

export default Tab2;
