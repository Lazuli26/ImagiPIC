import { ShapeTypes } from "geometrizejs";
import { GeometrizeOptions } from "./Types";

export const defaultOptions: GeometrizeOptions  = {
    shapeTypes: [ShapeTypes.ROTATED_ELLIPSE, ShapeTypes.TRIANGLE],
    candidateShapesPerStep: 50,
    shapeMutationsPerStep: 50,
    alpha: 128,
    maxPixels: 100000
}