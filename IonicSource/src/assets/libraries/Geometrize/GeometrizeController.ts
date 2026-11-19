/* eslint-disable import/no-webpack-loader-syntax */
import { Bitmap } from "geometrizejs";
import { CompactShapeRow } from "../../../utils/compactShapeCodec";
import { GeometrizeInstance, GeometrizeOptions, geoSubscription, PromiseCallBack } from "./Types";

import GeometrizeWorker from "worker-loader!./GeometrizeWorker";

export class GeometrizeController implements GeometrizeInstance {
    worker?: GeometrizeWorker;
    promiseCallbackQueue = new Array<PromiseCallBack>()
    currentBitMap?: Bitmap
    private _pendingOptions?: GeometrizeOptions;

    private queueCallBack(resolve: PromiseCallBack["resolve"], reject: PromiseCallBack["reject"], name: string) {
        let id = Math.max(...this.promiseCallbackQueue.map(v => v.id), 0) + 1
        this.promiseCallbackQueue.push({ resolve, reject, id, name })
        this.broadCast()
        return id
    }

    private removeCallBackByID(id: number): PromiseCallBack {
        const callBackID = this.promiseCallbackQueue.findIndex(v => v.id === id)
        return this.promiseCallbackQueue.splice(callBackID, 1)[0]

    }

    private postMessage(payload: { type: keyof GeometrizeInstance; value?: any, id: number }) {
        if (payload.type === "setOptions") {
            this._pendingOptions = payload.value as GeometrizeOptions;
        }
        if (this.worker) {
            this.worker.postMessage(payload)
            return
        }
        // Controller not yet initialized (initialize() has not been called / no worker
        // started yet). For idempotent / safe calls we return a sensible local result
        // instead of rejecting — this lets callers set options / query state before
        // an image is loaded without crashing.
        switch (payload.type) {
            case "setOptions":
                // Options already stashed above. Resolve immediately.
                this.removeCallBackByID(payload.id).resolve(undefined)
                this.broadCast()
                return
            case "getOPtions":
                this.removeCallBackByID(payload.id).resolve(this._pendingOptions)
                this.broadCast()
                return
            case "getShapesJSON":
                this.removeCallBackByID(payload.id).resolve([] as string[])
                this.broadCast()
                return
            case "getShapesCompact":
                this.removeCallBackByID(payload.id).resolve([] as CompactShapeRow[])
                this.broadCast()
                return
            case "step":
                // No image loaded — return 0 new shapes, don't throw
                this.removeCallBackByID(payload.id).resolve([] as string[])
                this.broadCast()
                return
            case "initialize":
                // Shouldn't happen since initialize starts the worker before posting,
                // but handle gracefully.
                const msgInit = "Cannot call initialize without starting worker"
                this.removeCallBackByID(payload.id).reject(msgInit)
                throw new Error(msgInit)
            default:
                const message = "Cannot call any controller function without initializing first"
                this.removeCallBackByID(payload.id).reject(message)
                throw new Error(message)
        }
    }

    private startWorker() {
        if (this.worker) this.dispose()
        this.worker = new GeometrizeWorker()
        this.worker!.onmessage = (({ data: { type, value, id } }) => {

            const callback = this.removeCallBackByID(id)

            switch (type) {
                case "initialize":
                    this.currentBitMap = value;
                    // If any options were stashed via setOptions() prior to initialize,
                    // replay them into the fresh worker now.
                    if (this._pendingOptions) {
                        try {
                            this.setOptions(this._pendingOptions).finally(() => {
                                callback.resolve(value)
                                this.broadCast()
                            })
                            return
                        } catch (_e) {
                            // fall through to normal resolve below
                        }
                    }
                    callback.resolve(value)
                    break;
                case "exception":
                    callback.reject(value)
                    break;
                default:
                    callback.resolve(value)
                    break;
            }

            this.broadCast()
        })
    }

    initialize(imageURL: string, options?: GeometrizeOptions): Promise<Bitmap> {
        this.startWorker()

        const result = new Promise<Bitmap>((resolve, reject) => {
            const id = this.queueCallBack(resolve, reject, "initialize")
            this.postMessage({ type: "initialize", value: [imageURL, options], id })
        })
        return result;
    }
    step(steps = 1): Promise<string[]> {
        const result = new Promise<string[]>((resolve, reject) => {
            const id = this.queueCallBack(resolve, reject, "step")
            this.postMessage({ type: "step", value: steps, id })
        })
        return result;
    }
    setOptions(options: GeometrizeOptions): Promise<void> {
        const result = new Promise<void>((resolve, reject) => {
            const id = this.queueCallBack(resolve, reject, "setOptions")
            this.postMessage({ type: "setOptions", value: options, id })
        })
        return result;
    }
    getOPtions(): Promise<GeometrizeOptions | undefined> {
        const result = new Promise<GeometrizeOptions | undefined>((resolve, reject) => {
            const id = this.queueCallBack(resolve, reject, "getOPtions")
            this.postMessage({ type: "getOPtions", id })
        })
        return result;
    }
    getShapesJSON(): Promise<string[]> {
        const result = new Promise<string[]>((resolve, reject) => {
            const id = this.queueCallBack(resolve, reject, "getShapesJSON")
            this.postMessage({ type: "getShapesJSON", id })
        })
        return result;
    }
    getShapesCompact(): Promise<CompactShapeRow[]> {
        const result = new Promise<CompactShapeRow[]>((resolve, reject) => {
            const id = this.queueCallBack(resolve, reject, "getShapesCompact")
            this.postMessage({ type: "getShapesCompact", id })
        })
        return result;
    }

    subscriptions = new Array<{ subscription: geoSubscription, id: number }>()


    /** Subscribes to this controller to check the state
     * @param subscriber will be called anytime a major event occurs to the controller
     * @returns a function to unsubscribe
    */
    subscribe(subscriber: geoSubscription) {
        let id = Math.max(...this.subscriptions.map(v => v.id), 0) + 1
        this.subscriptions.push({ subscription: subscriber, id })


        return {
            unsubscribe: () => {
                this.subscriptions.splice(this.subscriptions.findIndex(v => v.id === id), 1)
            }, 
            id
        }
    }

    private broadCast(payload?: Parameters<geoSubscription>[0]) {
        this.subscriptions.forEach(s => {
            try {
                s.subscription({
                    busy: this.promiseCallbackQueue.length > 0,
                    ready: !!this.worker,
                    imageSelected: !!this.currentBitMap,
                    ...payload
                })
            } catch (error) {

            }
        })
    }
    dispose() {
        if (this.worker) {
            this.worker.terminate()
            this.worker = undefined
        }
        this.subscriptions = []
        this.promiseCallbackQueue = []
        this.currentBitMap = undefined
    }
}