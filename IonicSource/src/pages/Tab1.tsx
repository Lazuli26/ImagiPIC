import $ from 'jquery';
import _ from 'lodash';

import { IonButton, IonInput } from '@ionic/react';
import React from 'react';
import { connect } from 'react-redux';
import BasicPage from '../components/BasicPage';
import SvgRenderer from '../components/SvgRenderer';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import './Tab1.scss';
import { GeometrizeOptions } from '../assets/libraries/Geometrize/Types';
import { GeometrizeController } from '../assets/libraries/Geometrize/GeometrizeController';
import { GeoPlayer } from '../components/GeometrizePlayer.tsx/GeoPlayer';

class Tab extends React.Component<stateProps & dispatchProps, {
  Running: boolean,
  imgSelected: boolean,
  shapes: string[],
  shapesPerSecond: number,
  currentShape: number,
  currentGeoConfig: GeometrizeOptions | null,
  maxIterations: number,
  isControllerBusy: boolean
}> {
  InputRef: any;
  ImageRef: any;
  StepRef: HTMLIonButtonElement | undefined;

  geoController = new GeometrizeController()
  constructor(props: (stateProps & dispatchProps) | Readonly<stateProps & dispatchProps>) {
    super(props);
    this.InputRef = React.createRef();
    this.ImageRef = React.createRef();
    this.state = {
      Running: false,
      imgSelected: false,
      shapes: [],
      shapesPerSecond: 4,
      currentShape: 0,
      currentGeoConfig: null,
      maxIterations: 3000,
      isControllerBusy: false
    }

    this.geoController.subscribe((controllerState) => {
      this.setState({ isControllerBusy: controllerState.busy })
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
        if (this.state.currentShape >= (this.state.maxIterations || 0)) {
          this.clearShapeInterval()
        }
        this.setState(state => ({ ...state, currentShape: state.currentShape + 5 }))
      }, 1000 / this.state.shapesPerSecond)
    }
  }

  changeShapesPerSecond = (shapesPerSecond: number) => {
    this.setState({ shapesPerSecond })
    this.startShapeInterval()
  }

  runAuto = () => {
    // TODO: Receive only the new shapes 
    GeoWorkerInstance.Step(10).then((shapes) => {
      if (this.state.Running) {
        this.setState(state => {
          const shapes = [...state.shapes, ...newShapes]
          return ({ shapes, Running: this.state.Running && _.size(shapes) <= this.state.maxIterations })
        }
        , () => {
          if (this.shapeInterval == null && this.state.shapes.length > this.state.shapesPerSecond * 2) {
            this.startShapeInterval()
          }
          this.runAuto();
        });
      }
    });

  }

  render() {
    const { imgSelected, Running, shapes, currentShape, maxIterations } = this.state;


    const renderShapes = shapes.slice(0, currentShape)
    return (
      <>
        <BasicPage title="ImagiPIC App">
          <div className="pageContent">
            <SvgRenderer shapes={renderShapes} width={this.geoController.currentBitMap?.width ?? 0} height={this.geoController.currentBitMap?.height ?? 0} />
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
                      this.geoController.step(stepAmount).then((shapes) => {
                        this.setState(state => ({ shapes: [...state.shapes, ...shapes], currentShape: currentShape + stepAmount }))
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
                {imgSelected && <span children={`Shapes: ${currentShape}/${_.size(shapes)}; shapes cap: ${maxIterations}`} />}
              </div>
              <IonInput type='number' onIonChange={e => {
                this.setState({ currentShape: Math.min(parseInt(e.detail.value || "0"), shapes.length) })
              }} value={currentShape} disabled={this.shapeInterval != null} />
            </div>

          </div>
            <GeoPlayer/>
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
              this.geoController.initialize(reader.result as string).finally(() => {
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
