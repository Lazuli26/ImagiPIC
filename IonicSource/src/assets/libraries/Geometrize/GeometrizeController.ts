/* eslint-disable import/no-webpack-loader-syntax */
import { Bitmap } from "geometrizejs";
import { GeometrizeInstance, GeometrizeOptions, geoSubscription, PromiseCallBack } from "./Types";

import GeometrizeWorker from "worker-loader!./GeometrizeWorker";

export class GeometrizeController implements GeometrizeInstance {
    worker?: GeometrizeWorker;
    promiseCallbackQueue = new Array<PromiseCallBack>()
    currentBitMap?: Bitmap

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
        if (this.worker)
            this.worker.postMessage(payload)
        else {
            const message = "Cannot call any controller function without initializing first"
            this.removeCallBackByID(payload.id).reject(message)
            throw new Error(message);
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