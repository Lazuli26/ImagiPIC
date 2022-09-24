/* eslint-disable no-restricted-globals */
// use import like you would in any other file
import Jimp from 'jimp'
import { Bitmap, ImageRunner, ImageRunnerOptions, ShapeTypes, SvgExporter } from 'geometrizejs'
import { defaultOptions, defaultMaxIterations } from './Geo.defaults';
import { geoEngineConfig, GeometrizeClass } from './Geo.types';

export class GeometrizeEngine implements GeometrizeClass {
    private _options: ImageRunnerOptions = defaultOptions;

    /**Current options of the runner */
    public get options(): ImageRunnerOptions {
        return this._options;
    }
    public set options(value: ImageRunnerOptions) {
        this._options = value;
    }
    iteration: number = 0;
    MaxIterations: number | null = defaultMaxIterations;
    runner?: ImageRunner;

    private _shapes: string[] = [];
    /**Shapes currently stored */
    public get shapes(): string[] {
        return this._shapes;
    }
    public set shapes(value: string[]) {
        this._shapes = value;
    }

    constructor(options?: ImageRunnerOptions, maxIterations?: number) {
        this.Reset();
        if (options)
            this.options = options;
        if (maxIterations)
            this.MaxIterations = maxIterations;
    }
    private Reset() {
        this.iteration = 0;
        this.MaxIterations = defaultMaxIterations;
        this.options = defaultOptions;
        this.shapes = [];
        this.runner = undefined;
    }
    bitmap: Bitmap | undefined;
    MaxPixelPerImage = 100000;
    async SetImage(imageURL: string): Promise<Bitmap> {
        this.shapes = [];
        this.iteration = 0;
        const image = await Jimp.read(imageURL);
        const totalPixels = image.bitmap.width * image.bitmap.height;
        console.log("Original pixel count: ", totalPixels)
        if (totalPixels > this.MaxPixelPerImage) {
            const scale = Math.sqrt(totalPixels / this.MaxPixelPerImage);
            image.resize(Math.floor(image.bitmap.width / scale), Jimp.AUTO)
        }
        this.bitmap = Bitmap.createFromByteArray(image.bitmap.width,
            image.bitmap.height, image.bitmap.data)
        this.runner = new ImageRunner(this.bitmap)

        return this.bitmap;
    }

    public async Step(steps: number = 1): Promise<string[]> {
        if (this.runner !== undefined && this.bitmap !== undefined && (this.MaxIterations == null || this.iteration < this.MaxIterations)) {
            const newShapes = [];
            for (let i = 0; i < steps && (this.MaxIterations == null || this.iteration < this.MaxIterations); i++) {
                this.iteration++;
                newShapes.push(SvgExporter.exportShapes((this.runner as ImageRunner).step(this.options)))
            }
            this.shapes = this.shapes.concat(newShapes)
            // in the browser:
            /*const container = document.getElementById('svg-container');
            if (container) {
                container.innerHTML = svg;
                const svgElement = $("#svg-container > svg").first();
                svgElement.attr("viewBox", `0 0 ${this.bitmap?.width || 0} ${this.bitmap?.height || 0}`)
                svgElement.removeAttr("height")
                svgElement.removeAttr("width")
                svgElement.addClass("geometrizeView")
            }*/
        }
        return (this.shapes);
    }
    public GenerateSvg = async (shapes: string[]) => {
        return SvgExporter.getSvgPrelude() +
            SvgExporter.getSvgNodeOpen((this.bitmap?.width || 0), (this.bitmap?.height || 0)) +
            shapes.join('\n') +
            SvgExporter.getSvgNodeClose()
    }

    public GetGeoOptions = async (): Promise<geoEngineConfig> => {
        const { MaxPixelPerImage, MaxIterations, _options } = this
        return {
            MaxIterations,
            MaxPixelPerImage,
            RunnerOptions: _options
        }
    };
    public SetGeoOptions = async ({ RunnerOptions, MaxIterations, MaxPixelPerImage }: geoEngineConfig): Promise<geoEngineConfig> => {
        this.options = RunnerOptions
        this.MaxPixelPerImage = MaxPixelPerImage
        this.MaxIterations = MaxIterations

        return {
            RunnerOptions: this.options,
            MaxPixelPerImage: this.MaxPixelPerImage,
            MaxIterations: this.MaxIterations
        }
    };
}

const ctx: Worker = self as any;

const geoEngine = new GeometrizeEngine();
ctx.onmessage = event => {
    // console.log("Worker received a message", event)
    const { data: { type, value } } = event
    switch (type) {
        case "SetImage":
            geoEngine.SetImage(value).then(
                (value) => ctx.postMessage({ type, value })
            )
            break;
        case "Step":
            geoEngine.Step(value).then(
                (value) => ctx.postMessage({ type, value }))
            break;
        case "GenerateSvg":
            geoEngine.GenerateSvg(value).then(value => {
                ctx.postMessage({ type, value })
            })
            break;
        case "GetCurrentOptions":
            geoEngine.GetGeoOptions().then(value => {
                ctx.postMessage({ type, value })
            })
            break;
        case "SetGeoOptions":
            geoEngine.SetGeoOptions(value).then(value => {
                ctx.postMessage({ type, value })
            })
            break;
        default:
            break;
    }
}
// Post data to parent thread
// ctx.postMessage({ foo: "foo" });

// Respond to message from parent thread
// ctx.addEventListener("message", (event) => console.log(event, new GeometrizeEngine().GenerateSvg([])));