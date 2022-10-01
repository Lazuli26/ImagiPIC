import { Bitmap, ImageRunnerOptions } from "geometrizejs"

export interface GeometrizeOptions extends ImageRunnerOptions {
    maxPixels: number
}

export interface GeometrizeInstance {
    initialize(imageURL: string, options: GeometrizeOptions): Promise<Bitmap>
    step(steps?: number): Promise<string[]>
    setOptions(options: GeometrizeOptions): Promise<void>
    getOPtions(): Promise<GeometrizeOptions | undefined>
    getShapesJSON(): Promise<string[]>
    // setImage(imageURL: string): Promise<Bitmap>
}

export type PromiseCallBack = {
    resolve: (value: any | PromiseLike<any>) => void,
    reject: (reason: any) => any,
    id: number
}
export type geoControllerStatus = { busy: boolean, imageSelected: boolean, ready: boolean }
export type geoSubscription = (state: geoControllerStatus) => void