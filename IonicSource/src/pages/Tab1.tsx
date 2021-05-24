import _ from 'lodash';
import $ from 'jquery'

import React from 'react';
import { IonButton } from '@ionic/react';
import './Tab1.scss';
import { connect } from 'react-redux';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import { GeometrizeEngine } from '../assets/libraries/Geometrize';
import BasicPage from '../components/BasicPage';
import SvgRenderer from '../components/SvgRenderer';

const GeometrizeRunner = new GeometrizeEngine();
class Tab extends React.Component<stateProps & dispatchProps, { Running: boolean, imgSelected: boolean, shapes: string[] }> {
  InputRef: any;
  ImageRef: any;
  StepRef: HTMLIonButtonElement | undefined;
  constructor(props: (stateProps & dispatchProps) | Readonly<stateProps & dispatchProps>) {
    super(props);
    this.InputRef = React.createRef();
    this.ImageRef = React.createRef();
    this.state = {
      Running: false,
      imgSelected: false,
      shapes: []
    }
  }
  runAuto = () => {
    GeometrizeRunner.step(1).then((shapes) => {
      this.setState({ shapes, Running: this.state.Running && _.size(shapes) !== GeometrizeRunner.maxIterations });
      if (this.state.Running) this.runAuto();
    });
  }

  render() {
    const { imgSelected, Running, shapes } = this.state;
    return (
      <>
        <BasicPage title="ImagiPIC App">
          <div className="pageContent">
            <SvgRenderer shapes={shapes} width={GeometrizeRunner.bitmap?.width ?? 0} height={GeometrizeRunner.bitmap?.height ?? 0} />
            <div className="controlContainer">
              <IonButton
                children="Escoger Imagen"
                className="controlBtn"
                onClick={async () => {
                  this.setState({ Running: false });
                  this.InputRef?.current?.click()
                }} />
              {
                imgSelected && [
                  !Running && <IonButton
                    children="Paso a paso"
                    className="controlBtn" disabled={Running || !imgSelected}
                    ref={ref => this.StepRef = ref as HTMLIonButtonElement} onClick={async () => {
                      this.setState({ Running: false });
                      $("#loadingDiv").show()
                      GeometrizeRunner.step().then((shapes) => {
                        this.setState({ shapes })
                      }).finally(() => {
                        $("#loadingDiv").hide()
                      })
                    }} />,
                  <IonButton
                    children={Running ? "Detener" : "Ir automáticamente"}
                    className="controlBtn"
                    disabled={!imgSelected} onClick={Running ?
                      () => {
                        this.setState({ Running: false });
                      } :
                      () => {
                        this.setState({ Running: true });
                        this.runAuto()
                      }} />
                ]
              }
              <div style={{display: "inline-block"}}>
                <div id="loadingDiv" style={{ display: "none" }}>Cargando...</div><br />
                {imgSelected && <span children={`Shapes: ${_.size(shapes)}`} />}
              </div>
            </div>

          </div>
          {/*<IonButton onClick={() => {
            props.changeLanguage(props.currentLanguage === "es" ? "en" : "es")
          }}>
            {props.Language.menu.play_btn}
          </IonButton>*/}
          {//<ExploreContainer name="Here we will do ImagiPIC" />
          }
        </BasicPage>
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
                this.setState({ imgSelected: true, shapes: [] })
                this.StepRef?.click();
              });
            }
            //@ts-ignore
            reader.readAsDataURL(_.get(event.target.files, 0));
          }

        }} />
      </>
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
