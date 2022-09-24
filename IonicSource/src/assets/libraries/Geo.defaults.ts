import { ShapeTypes } from "geometrizejs";

export const defaultOptions = {
    shapeTypes: [ShapeTypes.ROTATED_ELLIPSE, ShapeTypes.TRIANGLE],
    candidateShapesPerStep: 50,
    shapeMutationsPerStep: 50,
    alpha: 128
}
export const defaultMaxIterations = 2500;