import _ from 'lodash';

import React, { MutableRefObject, useRef } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './Tab1.css';
import { connect } from 'react-redux';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import { GeometrizeEngine } from '../assets/libraries/Geometrize';

const Tab: React.FC<stateProps & dispatchProps> = props => {
  const GeometrizeRunner = new GeometrizeEngine();
  var InputRef: MutableRefObject<HTMLInputElement | null> = useRef(null);
  var ImageRef: MutableRefObject<HTMLImageElement | null> = useRef(null);

  const runAuto = () =>{
    GeometrizeRunner.step(1, runAuto);
  }
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
        <div>
          <span className="geometrizeView" id="svg-container" />
        </div>
<div id="loadingDiv" style={{display:"none"}}>Cargando...</div>
        {/*<IonButton onClick={() => {
          props.changeLanguage(props.currentLanguage === "es" ? "en" : "es")
        }}>
          {props.Language.menu.play_btn}
        </IonButton>*/}
        <img className="originalImage" ref={ImageRef} alt="" />
        <input ref={InputRef} style={{ display: "none" }} type="file" title="input" accept="image/jpeg, image/png, image/bmp." onChange={event => {
          if (_.get(event.target.files, 0)) {

            var reader = new FileReader();

            reader.onload = function (e) {
              if (ImageRef.current)
                //@ts-ignore
                ImageRef.current.src = reader.result;
              GeometrizeRunner.SetImage(reader.result as string);
            }
            //@ts-ignore
            reader.readAsDataURL(_.get(event.target.files, 0));
          }

        }} />
        <IonButton onClick={() => {
          InputRef?.current?.click()
        }}>
          Escoger Imagen
        </IonButton>
        <IonButton onClick={() => {
          GeometrizeRunner.step()
        }}>
          Paso a paso
        </IonButton>
        <IonButton onClick={runAuto}>
          Ir automáticamente
        </IonButton>
        {//<ExploreContainer name="Here we will do ImagiPIC" />
        }
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
