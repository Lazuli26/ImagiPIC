import $ from 'jquery';
import _ from 'lodash';

import { IonButton, IonInput } from '@ionic/react';
import React from 'react';
import { connect } from 'react-redux';
import { geoEngineConfig } from '../assets/libraries/Geo.types';
import { GeoWorkerInstance } from '../assets/libraries/Geometrize';
import BasicPage from '../components/BasicPage';
import SvgRenderer from '../components/SvgRenderer';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import './Tab1.scss';

class Tab extends React.Component<stateProps & dispatchProps, {
  Running: boolean,
  imgSelected: boolean,
  shapes: string[],
  shapesPerSecond: number,
  currentShape: number,
  currentGeoConfig: geoEngineConfig | null
}> {
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
      shapes: [],
      shapesPerSecond: 10,
      currentShape: 0,
      currentGeoConfig: null
    }

    GeoWorkerInstance.GetGeoOptions().then(currentGeoConfig => {
      this.setState({ currentGeoConfig })
    })
  }

  shapeInterval: NodeJS.Timeout | null = null
  clearShapeInterval = () => {
    if (this.shapeInterval) {

      clearInterval(this.shapeInterval)
      this.shapeInterval = null
      this.forceUpdate()

    }
  }
  startShapeInterval = () => {
    this.clearShapeInterval();
    if (this.shapeInterval == null) {

      this.shapeInterval = setInterval(() => {
        if (this.state.currentShape >= (this.state.currentGeoConfig?.MaxIterations || 0)) {
          debugger
          this.clearShapeInterval()
        }
        this.setState(state => ({ ...state, currentShape: state.currentShape + 5 }))
      }, 1000 / this.state.shapesPerSecond / 5)
    }
  }

  changeShapesPerSecond = (shapesPerSecond: number) => {
    this.setState({ shapesPerSecond })
    this.startShapeInterval()
  }

  runAuto = () => {
    GeoWorkerInstance.Step(10).then((shapes) => {
      if (this.state.Running) {
        this.setState({ shapes, Running: this.state.Running && _.size(shapes) !== GeoWorkerInstance.MaxIterations }, () => {
          if (this.shapeInterval == null && this.state.shapes.length > this.state.shapesPerSecond * 2) {
            this.startShapeInterval()
          }
          this.runAuto();
        });
      }
    });

  }

  render() {
    const { imgSelected, Running, shapes, currentShape } = this.state;


    return (
      <>
        <BasicPage title="ImagiPIC App">
          <div className="pageContent">
            <SvgRenderer shapes={shapes.slice(0, currentShape)} width={GeoWorkerInstance.bitmap?.width ?? 0} height={GeoWorkerInstance.bitmap?.height ?? 0} />
            <div className="controlContainer">
              <IonButton
                children="Escoger Imagen"
                className="controlBtn"
                onClick={async () => {
                  this.setState({ Running: false });
                  this.clearShapeInterval()
                  this.InputRef?.current?.click()
                }} />
              {
                imgSelected && [
                  !Running && <IonButton
                    children="Paso a paso"
                    className="controlBtn" disabled={Running || !imgSelected}
                    ref={ref => this.StepRef = ref as HTMLIonButtonElement} onClick={async () => {
                      const stepAmount = 1
                      this.setState({ Running: false });
                      $("#loadingDiv").show()
                      GeoWorkerInstance.Step(stepAmount).then((shapes) => {
                        this.setState({ shapes, currentShape: currentShape + stepAmount })
                      }).finally(() => {
                        $("#loadingDiv").hide()
                      })
                    }} />,
                  <IonButton
                    children={this.shapeInterval != null || Running ? "Detener" : "Ir automáticamente"}
                    className="controlBtn"
                    disabled={!imgSelected} onClick={
                      () => {
                        if (this.shapeInterval != null) {

                          this.setState({ Running: false }, () => {
                            this.clearShapeInterval()
                          });
                        }
                        else {

                          this.setState({ Running: true });
                          this.runAuto()
                        }
                      }
                    } />
                ]
              }
              <div style={{ display: "inline-block" }}>
                <div id="loadingDiv" style={{ display: "none" }}>Cargando...</div><br />
                {imgSelected && <span children={`Shapes: ${currentShape}/${_.size(shapes)}; shapes cap: ${this.state.currentGeoConfig?.MaxIterations}`} />}
              </div>
              <IonInput type='number' onIonChange={e => {
                this.setState({ currentShape: Math.min(parseInt(e.detail.value || "0"), shapes.length) })
              }} value={currentShape} disabled={this.shapeInterval != null} />
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
              GeoWorkerInstance.SetImage(reader.result as string).finally(() => {
                $("#loadingDiv").hide()
                this.setState({ imgSelected: true, shapes: [], currentShape: 0 })
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
