/* eslint-disable no-restricted-globals */
// use import like you would in any other file

import { GeometrizeEngine } from "./GeometrizeEngine";


const ctx: Worker = self as any;

const geoEngine = new GeometrizeEngine();
ctx.onmessage = event => {
    // console.log("New Worker Event", event)
    const { data: { type, value, id } } = event
    switch (type) {
        case "initialize":
            geoEngine.initialize(value[0], value[1]).then(
                (value) => ctx.postMessage({ type, value, id })
            ).catch(err => ctx.postMessage({ type: "exception", value: err, id }))
            break;
        case "step":
            geoEngine.step(value).then(
                (value) => ctx.postMessage({ type, value, id })).catch(err => ({ type: "exception", value: err, id }))
            break;
        case "setOptions":
            geoEngine.setOptions(value).then(value => {
                ctx.postMessage({ type, value, id })
            }).catch(err => ({ type: "exception", value: err, id }))
            break;
        case "getOPtions":
            geoEngine.getOPtions().then(value => {
                ctx.postMessage({ type, value, id })
            }).catch(err => ({ type: "exception", value: err, id }))
            break;
        case "getShapesJSON":
            geoEngine.getShapesJSON().then(value => {
                ctx.postMessage({ type, value, id })
            }).catch(err => ({ type: "exception", value: err, id }))
            break;
        default:
            break;
    }
}