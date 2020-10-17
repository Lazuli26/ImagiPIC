import React from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import ExploreContainer from '../components/ExploreContainer';
import './Tab1.css';
import { connect } from 'react-redux';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import { RunGeometrize } from '../assets/libraries/Geometrize';

const Tab: React.FC<stateProps & dispatchProps> = props => {
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
        <span id="svg-container"/>
        <IonButton onClick={() => {
          props.changeLanguage(props.currentLanguage === "es" ? "en" : "es")
        }}>
          {props.Language.menu.play_btn}
        </IonButton>
        <IonButton onClick={RunGeometrize}>
          Test Geometrize
        </IonButton>
        <ExploreContainer name="Here we will do ImagiPIC" />
      </IonContent>
    </IonPage>
  );
};

interface stateProps {
  currentLanguage: keyof typeof langs,
  Language: LanguageType
}
interface dispatchProps {
  changeLanguage: typeof ChangeLang
}
const mapStateToProps: (state: CombinedState) => stateProps = state => ({
  currentLanguage: state.Language.current,
  Language: langs[state.Language.current]
})
const mapDispatchToProps: (dispatch: Function) => dispatchProps = dispatch => {
  const changeLang: typeof ChangeLang = lang => dispatch(ChangeLang(lang));
  return {
    changeLanguage: changeLang
  }
}
export const Tab1 = connect(mapStateToProps, mapDispatchToProps)(Tab);
