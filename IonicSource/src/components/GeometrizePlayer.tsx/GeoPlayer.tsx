import { InputChangeEventDetail } from "@ionic/core/components";
import { Bitmap } from "geometrizejs";
import _ from "lodash";
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultOptions } from "../../assets/libraries/Geometrize/defaults";
import { GeometrizeController } from "../../assets/libraries/Geometrize/GeometrizeController";
import { GeometrizeOptions } from "../../assets/libraries/Geometrize/Types";
import SvgRenderer from "../SvgRenderer";
import { BaseGeoPlayerControl } from "./BaseController";

const MAX_UPDATES_PER_SECOND = 5;

export type GeoPlayerInfo = {
    shapes_loaded: number,
    shapes_shown: number,
    shapes_cap: number,
    background_loading: boolean,
    playing: boolean,
    speed: number,
    is_image_set: boolean,
    current_options: GeometrizeOptions,
}
export interface GeoPlayerOptions {
    background_loading(fill_shapes_in_background?: boolean): boolean,
    play_pause(state?: boolean): boolean,
    set_speed(shapesPerSecond: numberInput): void,
    set_cap(shapes_cap: numberInput): number,
    set_image(Image: string): Promise<boolean>,
    options(options?: Partial<GeometrizeOptions>): Promise<GeometrizeOptions>
    jump_to(shapeNumber: number): Promise<number>,
    // get_info(): GeoPlayerInfo,
    // subscribe_to_info(subscriber: (info: GeoPlayerInfo) => any): (() => void),
    get_JSON_shapes(): Promise<string[]>,
    ControllerInstance: React.MutableRefObject<GeometrizeController>
}

type stateRefReturn<T> = React.MutableRefObject<{
    val: T;
    set: (update: T | ((oldVal: T) => T)) => void;
}>

function useStateRef<T = undefined>(value?: undefined): stateRefReturn<T | undefined>["current"]
function useStateRef<T>(value: T): stateRefReturn<T>["current"]
function useStateRef<T>(default_value: T): stateRefReturn<T>["current"] {
    const [valueState, setState] = useState(default_value)

    const valueRef = useRef({
        val: valueState,
        set: useCallback(function (update: T | ((oldVal: T) => T)) {
            let newVal: T
            if (_.isFunction(update)) newVal = update(valueRef.current.val)
            else newVal = update
            if (!_.isEqual(valueRef.current.val, newVal)) {
                valueRef.current.val = newVal
                setState(newVal)
            }
        }, [])
    })

    return valueRef.current
}

export type numberInput = number | string | React.FormEvent<HTMLIonInputElement>;
export const numberInputParse = (value: numberInput) => {
    if (_.isNumber(value)) return value
    else
        return parseInt(_.isString(value) ? value : value.currentTarget.value as string ?? "")

}

export const GeoPlayer: React.FC<{}> = (props) => {
    const GeoControllerRef = useRef(new GeometrizeController())
    const { current: GeoController } = GeoControllerRef
    const PlayerRef = useRef<HTMLDivElement>(null)

    const shapes = useStateRef(new Array<string>())
    const isControllerBussy = useStateRef(false);


    // Play/Pause control
    const playing = useStateRef(false)
    const play_pause = useCallback((state?) => {
        if (state === undefined) return (playing.val)
        else {
            const result = state ?? !playing.val
            playing.set(result)
            return (result)
        }
    }, [playing])

    // Speed Changer
    const speed = useStateRef(4)
    const set_speed = useCallback((_shapesPerSecond: numberInput): void => {
        const shapesPerSecond = numberInputParse(_shapesPerSecond)
        if (shapesPerSecond === 0) speed.set(currentSpeed => Math.sign(currentSpeed))
        else speed.set(shapesPerSecond)
    }, [speed])

    // Max Shapes to Generate
    const targetShapes = useStateRef(1000)
    const set_cap = useCallback((_shapes_cap: numberInput) => {
        const shapes_cap = Math.max(numberInputParse(_shapes_cap), 1, shapes.val.length);
        targetShapes.set(shapes_cap)
        shapes.set(shapes.val.slice(0, shapes_cap))
        return shapes_cap
    }, [shapes, targetShapes])

    // Controls custom options for the geometrize
    const _options = useStateRef<GeometrizeOptions>(defaultOptions)
    const options = useCallback((options?: Partial<GeometrizeOptions>) => {
        return new Promise<GeometrizeOptions>((resolve, reject) => {

            _options.set(currentOptions => {
                const newOptions = ({ ...currentOptions, ...options })
                GeoController.setOptions(newOptions)

                resolve(newOptions)
                return newOptions
            });
        })
    }, [GeoController, _options])

    // Controls the current position of the cursor
    const shapeCursor = useStateRef(0)
    const jump_to = useCallback((shapeNumber: number): Promise<number> => new Promise((resolve, reject) => {
        shapes.set(shapes => {
            const was_playing = play_pause()
            play_pause(false)

            const newCursorPosition = _.max([_.min([shapeNumber, shapes.length]), 0])!
            shapeCursor.set(newCursorPosition)


            play_pause(was_playing)
            resolve(newCursorPosition)
            return shapes
        })
    }), [play_pause, shapeCursor, shapes])

    const Image = useStateRef<Bitmap>()
    const set_image = useCallback((ImageSrc: string) => {
        return new Promise<boolean>((resolve, reject) => {
            GeoController.initialize(ImageSrc).then((img) => {
                shapes.set([])
                shapeCursor.set(0)
                Image.set(img)
                resolve(true)
            }).catch(reject)
        })
    }, [GeoController, Image, shapeCursor, shapes])

    // Enable/Disable background loading

    // Controls if the player should generate images automatically on the background
    const backgroundLoading = useStateRef(true)
    const background_loading = useCallback((val?: boolean) => {
        if (val === undefined) return backgroundLoading.val
        else {
            backgroundLoading.set(val)
            return val
        }
    }, [backgroundLoading])

    // Get basic player information
    const get_info = useCallback((): GeoPlayerInfo => {
        return {
            shapes_loaded: shapes.val.length,
            shapes_shown: shapeCursor.val,
            shapes_cap: targetShapes.val,
            background_loading: backgroundLoading.val,
            playing: playing.val,
            speed: speed.val,
            is_image_set: !!Image.val,
            current_options: _options.val,
        }
    }, [Image.val, _options.val, backgroundLoading, playing.val, shapeCursor.val, shapes.val.length, speed.val, targetShapes.val])

    const currentPlayerInfo = useStateRef(get_info())
    currentPlayerInfo.set(get_info())
    // Get shapes as JSON objects
    const get_JSON_shapes = useCallback(() => {
        return GeoController.getShapesJSON()
    }, [GeoController]);

    // controls to expose to other components
    const PlayerUI = useMemo<GeoPlayerOptions>(() => ({
        background_loading,
        play_pause,
        set_speed,
        set_cap,
        set_image,
        options,
        jump_to,
        // get_info,
        get_JSON_shapes,
        ControllerInstance: GeoControllerRef
    }), [background_loading, get_JSON_shapes, jump_to, options, play_pause, set_cap, set_image, set_speed])



    // To indicate if the controller is currently processing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const changeBusyStatus_debounce = useCallback(
        _.debounce(isControllerBussy.set, 250),
        [isControllerBussy]
    )

    // Controls state messages from the controller
    const controllerSubscribtion = useMemo(() => GeoController.subscribe((geoStatus) => {
        (geoStatus.busy ? isControllerBussy.set : changeBusyStatus_debounce)(geoStatus.busy)
    }), [GeoController, changeBusyStatus_debounce, isControllerBussy])

    // Unsubscribe from the controller
    useEffect(() => {
        return () => {
            controllerSubscribtion.unsubscribe()
            GeoController.dispose()
        }
    }, [GeoController, controllerSubscribtion])

    const step = useCallback(steps => {
        GeoController.step(steps).then(newShapes => {
            const _shapes = [...shapes.val, ...newShapes]
            shapes.set(_shapes)
        })
    }, [GeoController, shapes])
    // Shape generator effect
    useEffect(() => {
        if (Image.val && backgroundLoading.val) {

            const remainingShapes = targetShapes.val - shapes.val.length
            if (remainingShapes > 0) {
                step(_.min([10, remainingShapes]))
            }
        }
    }, [GeoController, Image.val, backgroundLoading.val, shapes, shapes.val.length, step, targetShapes.val])

    // Update frequency
    const updateFreq = useStateRef<NodeJS.Timeout>()
    useEffect(() => {
        if (updateFreq.val !== undefined)
            clearInterval(updateFreq.val)

        if (playing.val) {
            const targetFrequency = _.max([1000 / MAX_UPDATES_PER_SECOND, 1000 / speed.val]) ?? 1000
            const changesPerUpdate = Math.ceil((targetFrequency / 1000) * speed.val)
            
            const remainingShapes = targetShapes.val - shapes.val.length
            updateFreq.set(setInterval(() => {
                if (!backgroundLoading.val && !isControllerBussy.val && shapeCursor.val >= shapes.val.length - speed.val*2)
                    step(_.min([remainingShapes, speed.val]))

                shapeCursor.set(current => _.max([_.min([shapes.val.length, current + changesPerUpdate])!, 0])!)
            }, targetFrequency))
        }
    }, [GeoController, backgroundLoading, isControllerBussy, playing.val, shapeCursor, shapes, speed.val, step, targetShapes, updateFreq])


    // Lifecycle effect
    useEffect(() => {
    }, [])



    return <>
        <BaseGeoPlayerControl controllerInterface={PlayerUI} PlayerInfo={currentPlayerInfo.val} PlayerRef={PlayerRef} />
        <div ref={PlayerRef} style={{ height: "50vh", width: "50vw" }} children={
            <SvgRenderer shapes={shapes.val.slice(0, shapeCursor.val)} width={Image.val?.width ?? 0} height={Image.val?.height ?? 0} />}
        />

    </>
}