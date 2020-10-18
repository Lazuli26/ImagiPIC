import Jimp from 'jimp'
import { Bitmap, ImageRunner, ImageRunnerOptions, ShapeTypes, SvgExporter } from 'geometrizejs'
import $ from 'jquery'
export class GeometrizeEngine {
    private _options: ImageRunnerOptions = {
        shapeTypes: [ShapeTypes.CIRCLE],
        candidateShapesPerStep: 50,
        shapeMutationsPerStep: 100,
        alpha: 128
    };

    /**Current options of the runner */
    public get options(): ImageRunnerOptions {
        return this._options;
    }
    public set options(value: ImageRunnerOptions) {
        this._options = value;
    }
    iteration: number = 0;
    maxIterations: number = 200;
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
        this.maxIterations = 200;
        this.options = {
            shapeTypes: [ShapeTypes.CIRCLE],
            candidateShapesPerStep: 10,
            shapeMutationsPerStep: 20,
            alpha: 128
        };
        this.shapes = [];
        this.runner = undefined;
    }
    bitmap: Bitmap | undefined;
    maxPixels = 375000;
    async SetImage(imageURL: string) {
        this.shapes = [];
        this.iteration = 0;
        const image = await Jimp.read(imageURL);
        const totalPixels = image.bitmap.width * image.bitmap.height;
        if(totalPixels > this.maxPixels){
            const scale = this.maxPixels / totalPixels
            image.resize(Math.floor(image.bitmap.width * scale), Jimp.AUTO)
        }
        this.bitmap = Bitmap.createFromByteArray(image.bitmap.width,
            image.bitmap.height, image.bitmap.data)
        this.runner = new ImageRunner(this.bitmap)
        this.step(1);
    }

    public step(steps: number = 1, callBack?: Function) {
        if (this.runner !== undefined && this.bitmap !== undefined && this.iteration < this.maxIterations){
            for (let i = 0; i < steps && this.iteration < this.maxIterations; i++) {
                this.iteration++;
                this.shapes.push(SvgExporter.exportShapes(this.runner.step(this.options)))
            }
            const svg = SvgExporter.getSvgPrelude() +
                SvgExporter.getSvgNodeOpen(this.bitmap?.width || 0, this.bitmap?.height || 0) +
                this.shapes.join('\n') +
                SvgExporter.getSvgNodeClose()
    
            // in the browser:
            const container = document.getElementById('svg-container');
            if (container){
                container.innerHTML = svg;
                const svgElement = $("#svg-container > svg").first();
                svgElement.attr("viewBox", `0 0 ${this.bitmap?.width || 0} ${this.bitmap?.height || 0}`)
                svgElement.removeAttr("height")
                svgElement.removeAttr("width")
                svgElement.addClass("geometrizeView")
            }
            if(callBack){
                setTimeout(() => {
                    callBack();
                }, 500);
            }
                

        } 
        return null;
    }
}
