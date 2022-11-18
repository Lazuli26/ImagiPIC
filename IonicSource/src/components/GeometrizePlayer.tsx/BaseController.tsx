import { IonItem, IonLabel, IonInput, IonCheckbox, IonButton } from "@ionic/react"
import _ from "lodash"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GeoPlayerInfo, GeoPlayerOptions, numberInput, numberInputParse } from "./GeoPlayer"
import { PlayerBar } from "./PlayerBar";
const TakeOverInput = React.memo((props: React.ComponentPropsWithoutRef<typeof IonInput>) => {
    const [isFocus, setFocus] = useState(false)
    const [value, setValue] = useState(props.value)
    const ref = useRef<HTMLIonInputElement>(null)
    const onIonFocus = useCallback((...args: Parameters<NonNullable<typeof props["onIonFocus"]>>) => {
        setFocus(true)
        if (props.onIonFocus) props.onIonFocus(...args)
    }, [props])

    const onIonChange = useCallback((...args: Parameters<NonNullable<typeof props["onIonChange"]>>) => {
        if (props.onIonChange && isFocus) props.onIonChange(...args)
        setValue(args[0].detail.value)
    }, [isFocus, props])

    const onIonBlur = useCallback((...args: Parameters<NonNullable<typeof props["onIonBlur"]>>) => {
        setFocus(false)
        if (props.onIonBlur) props.onIonBlur(...args)
    }, [props])

    if (!isFocus && value !== props.value) setValue(props.value)
    return <>
        <IonInput ref={ref} {...props} onIonFocus={onIonFocus} onIonChange={onIonChange} onIonBlur={onIonBlur} value={isFocus ? value : props.value} />
    </>
})

// eslint-disable-next-line react-hooks/exhaustive-deps
const useDebounce = (func: (...args: any[]) => any, time: number) => useCallback(_.debounce(func, time), [func])

const _BaseGeoPlayerControl: React.FC<{
    controllerInterface: GeoPlayerOptions,
    PlayerRef: React.RefObject<HTMLDivElement>,
    PlayerInfo: GeoPlayerInfo
}> = ({ controllerInterface, PlayerInfo, PlayerRef }) => {
    const { shapes_cap: _shapes_cap, speed: _speed, playing, shapes_shown } = PlayerInfo

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

    const [, changeBusyStatus] = useState(false);

    // To indicate if the controller is currently processing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const changeBusyStatus_debounce = useCallback(
        _.debounce(changeBusyStatus, 250),
        []
    )

    const unsubscribe = useMemo(() => controllerInterface.ControllerInstance.current.subscribe((geoStatus) => {
        (geoStatus.busy ? changeBusyStatus : changeBusyStatus_debounce)(geoStatus.busy)
    }), [changeBusyStatus_debounce, controllerInterface.ControllerInstance])


    useEffect(() => {
        return () => {
            unsubscribe.unsubscribe()

        }
    }, [unsubscribe])

    const setCapDebounced = useDebounce((val: number) => {
        setShapesCap(controllerInterface.set_cap(val))
    }, 500)

    const onChangeShapeCap = useCallback((e: numberInput) => {
        const value = numberInputParse(e);
        setShapesCap(value)
        setCapDebounced(value)
    }, [setCapDebounced])

    const setSpeedDebounced = useDebounce(controllerInterface.set_speed, 500)
    const onChangeSpeed = useCallback((e: numberInput) => {
        const value = numberInputParse(e);

        setSpeed(value)
        setSpeedDebounced(value)
    }, [setSpeedDebounced])

    const jump_to = useDebounce((val: number) => controllerInterface.jump_to(val), 1000)
    const moveCursor = useCallback((e: numberInput) => {

        const value = numberInputParse(e);
        jump_to(value)
    }, [jump_to])

    return <>
        <IonItem>
            <IonLabel children="Shapes cap" position="stacked" />
            <IonInput
                type="number"
                inputmode="numeric"

                value={shapes_cap}
                onInput={onChangeShapeCap}
            />
        </IonItem>
        <IonItem>
            <IonLabel children="Speed" position="stacked" />
            <IonInput
                type="number"
                inputmode="numeric"

                value={speed}
                onInput={onChangeSpeed}
            />
        </IonItem>
        <IonItem>
            <IonLabel children={`Move Cursor ${PlayerInfo.shapes_shown}/${PlayerInfo.shapes_loaded}`} position="stacked" />
            <TakeOverInput
                type="number"
                inputmode="numeric"

                value={shapes_shown}
                onInput={moveCursor}
            />
        </IonItem>
        <IonItem>
            <IonLabel children={PlayerInfo.background_loading ? "Shapes will be generated as soon as possible" : "Shapes will be generated on-demand"} position="stacked" />
            <IonCheckbox checked={PlayerInfo.background_loading} onIonChange={toggleBackgroundLoading} />
        </IonItem>

        <PlayerBar Playing={playing} TogglePause={togglePlay} MoveCursor={controllerInterface.jump_to} totalFrames={PlayerInfo.shapes_cap} cursorPosition={PlayerInfo.shapes_shown} bufferSize={PlayerInfo.shapes_loaded}/>
        <IonButton onClick={togglePlay} children={playing ? "Pause" : "Play"} />
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