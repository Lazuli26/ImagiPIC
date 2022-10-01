import { IonItem, IonLabel, IonInput, IonCheckbox, IonButton } from "@ionic/react"
import _ from "lodash"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GeoPlayerInfo, GeoPlayerOptions, numberInputParse } from "./GeoPlayer"


const _BaseGeoPlayerControl: React.FC<{
    controllerInterface: GeoPlayerOptions,
    PlayerRef: React.RefObject<HTMLDivElement>,
    PlayerInfo: GeoPlayerInfo
}> = ({ controllerInterface, PlayerInfo, PlayerRef }) => {
    const { shapes_cap: _shapes_cap, speed: _speed, playing } = PlayerInfo

    const [shapes_cap, setShapesCap] = useState(_shapes_cap)
    const [speed, setSpeed] = useState(_speed)

    const toggleBackgroundLoading = useCallback(() => controllerInterface.background_loading(!controllerInterface.background_loading()), [controllerInterface])
    const togglePlay = useCallback(
        async () => controllerInterface.play_pause(!controllerInterface.play_pause()),
        [controllerInterface]
    )


    const imageInputRef = useRef<any>()
    const imageRef = useRef<any>()
    // To start the image set process
    const selectImg = useCallback(() => imageInputRef?.current?.click(), [])
    // Controls the event to change the image
    const onImageChange = useCallback(async (event) => {
        if (_.get(event.target.files, 0)) {

            var reader = new FileReader();

            reader.onload = (e) => {
                if (imageRef.current) {
                    imageRef.current.src = reader.result;
                    controllerInterface.set_image(reader.result as string)
                }
            }
            reader.readAsDataURL(_.get(event.target.files, 0));
        }
    }, [controllerInterface])

    const [isControllerBussy, changeBusyStatus] = useState(false);

    // To indicate if the controller is currently processing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const changeBusyStatus_debounce = useCallback(
        _.debounce(changeBusyStatus, 250),
        [isControllerBussy]
    )

    const unsubscribe = useMemo(() => controllerInterface.ControllerInstance.current.subscribe((geoStatus) => {
        (geoStatus.busy ? changeBusyStatus : changeBusyStatus_debounce)(geoStatus.busy)
    }), [changeBusyStatus_debounce, controllerInterface.ControllerInstance])


    useEffect(() => {
        return () => {
            unsubscribe.unsubscribe()

        }
    }, [unsubscribe])

    const setCapDebounced = useMemo(() => _.debounce((val: number) => {
        setShapesCap(controllerInterface.set_cap(val))
    }, 500), [controllerInterface])

    const onChangeShapeCap = useCallback(e => {
        const value = numberInputParse(e);
        setShapesCap(value)
        setCapDebounced(value)
    }, [setCapDebounced])

    const setSpeedDebounced = useMemo(() => _.debounce(controllerInterface.set_speed, 500), [controllerInterface.set_speed])
    const onChangeSpeed = useCallback(e => {
        const value = numberInputParse(e);

        setSpeed(value)
        setSpeedDebounced(value)
    }, [setSpeedDebounced])
    return <>
        <IonItem>
            <IonLabel children="Shapes cap" position="stacked" />
            <IonInput
                type="number"
                inputmode="numeric"

                value={shapes_cap}
                onIonChange={onChangeShapeCap}
            />
        </IonItem>
        <IonItem>
            <IonLabel children="Speed" position="stacked" />
            <IonInput
                type="number"
                inputmode="numeric"

                value={speed}
                onIonChange={onChangeSpeed}
            />
        </IonItem>
        <IonItem>
            <IonLabel children="Pre-generate shapes" position="stacked" />
            <IonCheckbox checked={controllerInterface.background_loading()} onIonChange={toggleBackgroundLoading} />
        </IonItem>

        <IonButton onClick={togglePlay} children={playing ? "Pause" : "Play"} />
        Current shapes
        <IonButton
            disabled={playing}
            children="Escoger Imagen"
            className="controlBtn"
            onClick={selectImg} />
        <img className="originalImage" ref={imageRef} alt="" />
        <input ref={imageInputRef} style={{ display: "none" }} type="file" title="input" accept="image/jpeg, image/png, image/bmp." onChange={onImageChange} />
    </>
}

export const BaseGeoPlayerControl = React.memo(_BaseGeoPlayerControl)/*, function (oldProps, newProps) {
    const isControllerEqual = oldProps.controllerInterface === newProps.controllerInterface
    const isPlayerRefEqual = oldProps.PlayerRef === newProps.PlayerRef
    const isPlayerEqual = oldProps.PlayerInfo === newProps.PlayerInfo

    debugger
    return isControllerEqual && isPlayerEqual && isPlayerRefEqual
})*/