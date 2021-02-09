import Jimp from 'jimp'
import { Bitmap, ImageRunner, ImageRunnerOptions, ShapeTypes, SvgExporter } from 'geometrizejs'

export interface GeometrizeClass {
    SetImage: (imageURL: string) => Promise<void>,
    step: (steps: number) => Promise<[string, number]>,
    generateSvg: (shapes: string[]) => string
}

const defaultOptions = {
    shapeTypes: [ShapeTypes.ROTATED_ELLIPSE, ShapeTypes.TRIANGLE],
    candidateShapesPerStep: 25,
    shapeMutationsPerStep: 50,
    alpha: 128
}
const defaultMaxIterations = 1000;
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
    maxIterations: number = defaultMaxIterations;
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
            this.maxIterations = maxIterations;
    }
    private Reset() {
        this.iteration = 0;
        this.maxIterations = defaultMaxIterations;
        this.options = defaultOptions;
        this.shapes = [];
        this.runner = undefined;
    }
    bitmap: Bitmap | undefined;
    maxPixels = 90000;
    async SetImage(imageURL: string): Promise<void> {
        this.shapes = [];
        this.iteration = 0;
        const image = await Jimp.read(imageURL);
        const totalPixels = image.bitmap.width * image.bitmap.height;
        if (totalPixels > this.maxPixels) {
            const scale = Math.sqrt(totalPixels / this.maxPixels);
            image.resize(Math.floor(image.bitmap.width / scale), Jimp.AUTO)
        }
        this.bitmap = Bitmap.createFromByteArray(image.bitmap.width,
            image.bitmap.height, image.bitmap.data)
        this.runner = new ImageRunner(this.bitmap)
    }

    public async step(steps: number = 1): Promise<[string, number]> {
        if (this.runner !== undefined && this.bitmap !== undefined && this.iteration < this.maxIterations) {
            const newShapes = [];
            for (let i = 0; i < steps && this.iteration < this.maxIterations; i++) {
                this.iteration++;
                newShapes.push(await this.stepTimeOut())
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
        return ([this.generateSvg(this.shapes), this.shapes.length]);
    }
    private stepTimeOut(): Promise<string> {
        return new Promise<string>(callback => {
            setTimeout(() => {
                callback(SvgExporter.exportShapes((this.runner as ImageRunner).step(this.options)))
            }, 100);
        })
    }
    public generateSvg(shapes: string[]): string {
        return SvgExporter.getSvgPrelude() +
            SvgExporter.getSvgNodeOpen((this.bitmap?.width || 0), (this.bitmap?.height || 0)) +
            shapes.join('\n') +
            SvgExporter.getSvgNodeClose()
    }
}
