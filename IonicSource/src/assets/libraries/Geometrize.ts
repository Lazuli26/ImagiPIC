import Jimp from 'jimp'
import { Bitmap, ImageRunner, ImageRunnerOptions, ShapeJsonExporter, ShapeTypes, SvgExporter } from 'geometrizejs'


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
    async SetImage(imageURL: string) {
        const image = await Jimp.read(imageURL);
        this.bitmap = Bitmap.createFromByteArray(image.bitmap.width,
            image.bitmap.height, image.bitmap.data)
        this.runner = new ImageRunner(this.bitmap)
        this.step(1);
    }

    public step(steps: number = 1) {
        if (this.runner !== undefined && this.bitmap !== undefined){
            for (let i = 0; i < steps; i++) {
                this.shapes.push(SvgExporter.exportShapes(this.runner.step(this.options)))
            }
            const svg = SvgExporter.getSvgPrelude() +
                SvgExporter.getSvgNodeOpen(this.bitmap?.width || 0, this.bitmap?.height || 0) +
                this.shapes.join('\n') +
                SvgExporter.getSvgNodeClose()
    
            // in the browser:
            const container = document.getElementById('svg-container');
            if (container)
                container.innerHTML = svg
        } 
        return null;
    }
}