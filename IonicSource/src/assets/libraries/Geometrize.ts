
// eslint-disable-next-line import/no-webpack-loader-syntax
import Worker from "worker-loader!./GeoWorker";

import { Bitmap } from 'geometrizejs';
import { defaultMaxIterations } from "./Geo.defaults";
import { geoEngineConfig, GeometrizeClass } from "./Geo.types";


class GeoWorkerInterface implements GeometrizeClass {
    worker = new Worker();
    get MaxIterations() {
        return defaultMaxIterations
    }
    _bitmap: Bitmap | undefined
    get bitmap() {
        return this._bitmap
    }
    promiseResolveQueue = new Array<({
        resolve: (value: any | PromiseLike<any>) => void,
        reject: (reason: any) => any
    })>()

    constructor() {
        this.worker.onmessage = (event) => {
            // console.log("Received message from worker", event)
            const { data: { type, value } } = event;
            const currentPromise = this.promiseResolveQueue.shift()!
            switch (type) {
                case "SetImage":
                    this._bitmap = value;
                    currentPromise.resolve(value)
                    break;
                case "exception":
                    currentPromise.reject(value)
                    break;
                default:
                    currentPromise.resolve(value)
                    break;
            }
        }
    }
    SetImage = (imageURL: string): Promise<Bitmap> => {
        const result = new Promise<Bitmap>((resolve, reject) => {
            this.promiseResolveQueue.push({ resolve, reject })
            this.worker.postMessage({ type: "SetImage", value: imageURL })
        })

        return result
    };
    Step = (steps = 1): Promise<string[]> => {

        const result = new Promise<string[]>((resolve, reject) => {
            this.promiseResolveQueue.push({ resolve, reject })
            this.worker.postMessage({ type: "Step", value: steps })
        })
        return result;
    };
    GenerateSvg(shapes: string[]): Promise<string> {
        const result = new Promise<string>((resolve, reject) => {
            this.promiseResolveQueue.push({ resolve, reject })
            this.worker.postMessage({ type: "Step", value: shapes })
        })
        return result;
    }

    GetGeoOptions = (): Promise<geoEngineConfig> => {
        const result = new Promise<geoEngineConfig>((resolve, reject) => {
            this.promiseResolveQueue.push({ resolve, reject })
            this.worker.postMessage({ type: "GetCurrentOptions" })
        })
        return result;
    }

    SetGeoOptions = async (config: geoEngineConfig): Promise<geoEngineConfig> => {

        const result = new Promise<geoEngineConfig>((resolve, reject) => {
            this.promiseResolveQueue.push({ resolve, reject })
            this.worker.postMessage({ type: "SetGeoOptions", value: config })
        })
        return result;
    };
}

export const GeoWorkerInstance = new GeoWorkerInterface();