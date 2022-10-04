
import React from 'react';
import { connect } from 'react-redux';
import { GeometrizeController } from '../assets/libraries/Geometrize/GeometrizeController';
import BasicPage from '../components/BasicPage';
import { GeoPlayer } from '../components/GeometrizePlayer.tsx/GeoPlayer';
import { langs, LanguageType } from '../lang';
import { CombinedState } from '../reducers';
import { ChangeLang } from '../reducers/language';
import './Tab1.scss';

class Tab extends React.Component<stateProps & dispatchProps> {
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

  render() {


    return (
      <>
        <BasicPage title="ImagiPIC App">
          <GeoPlayer />
        </BasicPage>
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
