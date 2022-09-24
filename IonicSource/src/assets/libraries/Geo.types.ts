import { Bitmap, ImageRunnerOptions } from "geometrizejs";

export interface geoEngineConfig {
    RunnerOptions: ImageRunnerOptions,
    MaxPixelPerImage: number,
    MaxIterations: number | null
}

export interface GeometrizeClass {
    SetImage: (imageURL: string) => Promise<Bitmap>,
    Step: (steps: number) => Promise<string[]>,
    MaxIterations: number | null,
    GenerateSvg: (shapes: string[]) => Promise<string>,
    GetGeoOptions: () => Promise<geoEngineConfig>
    SetGeoOptions: (config: geoEngineConfig) => Promise<geoEngineConfig>
}