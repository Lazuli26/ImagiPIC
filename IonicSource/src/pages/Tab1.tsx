import _ from 'lodash';
import $ from 'jquery'

import React from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './Tab1.css';
import { connect } from 'react-redux';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import { GeometrizeEngine } from '../assets/libraries/Geometrize';

const GeometrizeRunner = new GeometrizeEngine();
class Tab extends React.Component<stateProps & dispatchProps, { Running: boolean, imageSet: boolean }> {
  InputRef: any;
  ImageRef: any;
  StepRef: HTMLIonButtonElement | undefined;
  constructor(props: (stateProps & dispatchProps) | Readonly<stateProps & dispatchProps>) {
    super(props);
    this.InputRef = React.createRef();
    this.ImageRef = React.createRef();
    this.state = {
      Running: false,
      imageSet: false
    }
  }
  runAuto = () => {
    GeometrizeRunner.step(1).then(([value, count]) => {
      if(count === GeometrizeRunner.maxIterations) this.setState({Running: false});
      const container = $("#svg-container");
      container.html(value);
      if (container) {
        const svgElement = $("#svg-container > svg").first();
        svgElement.addClass("geometrizeView")
      }
      $("#ShapeCounter").html(String(count))
      if (this.state.Running) this.runAuto();
    });
  }

  render() {
    const { imageSet, Running } = this.state;
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
          <div id="loadingDiv" style={{ display: "none" }}>Cargando...</div>
          <div>Figuras: <span id="ShapeCounter">0</span></div>
          {/*<IonButton onClick={() => {
            props.changeLanguage(props.currentLanguage === "es" ? "en" : "es")
          }}>
            {props.Language.menu.play_btn}
          </IonButton>*/}
          <img className="originalImage" ref={this.ImageRef} alt="" />
          <input ref={this.InputRef} style={{ display: "none" }} type="file" title="input" accept="image/jpeg, image/png, image/bmp." onChange={async (event) => {
            if (_.get(event.target.files, 0)) {

              var reader = new FileReader();

              reader.onload = (e) => {
                if (this.ImageRef.current)
                  //@ts-ignore
                  this.ImageRef.current.src = reader.result;
                $("#loadingDiv").show()
                GeometrizeRunner.SetImage(reader.result as string).finally(() => {
                  $("#loadingDiv").hide()
                  this.setState({imageSet: true})
                  this.StepRef?.click();
                });
              }
              //@ts-ignore
              reader.readAsDataURL(_.get(event.target.files, 0));
            }

          }} />
          <IonButton onClick={async () => {
            this.setState({ Running: false });
            this.InputRef?.current?.click()
          }}>
            Escoger Imagen
          </IonButton>
          <IonButton disabled={Running || !imageSet} ref={ref => this.StepRef = ref as HTMLIonButtonElement} onClick={async () => {
            this.setState({ Running: false });
            $("#loadingDiv").show()
            GeometrizeRunner.step().then(([value, count]) => {
              $("#svg-container").html(value)
              $("#ShapeCounter").html(String(count))
            }).finally(() => {
              $("#loadingDiv").hide()
            })
          }}>
            Paso a paso
          </IonButton>
          <IonButton disabled={!imageSet} onClick={Running ?
            () => {
              this.setState({ Running: false });
            } :
            () => {
              this.setState({ Running: true });
              this.runAuto()
            }}>
            {Running ? "Detener" : "Ir automáticamente"}
          </IonButton>
          {//<ExploreContainer name="Here we will do ImagiPIC" />
          }
        </IonContent>
      </IonPage>
    )
  }
}
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
