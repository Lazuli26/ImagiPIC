import { Bitmap, ImageRunner, ShapeResult, SvgExporter, ShapeJsonExporter } from "geometrizejs";
import Jimp from "jimp";
import { defaultOptions } from "./defaults";
import { GeometrizeInstance, GeometrizeOptions } from "./Types";
import { CompactShapeRow, encodeFromShapeJson } from "../../../utils/compactShapeCodec";

export class GeometrizeEngine implements GeometrizeInstance {
    runner?: ImageRunner;
    bitMap?: Bitmap;
    options?: GeometrizeOptions;
    shapes?: ShapeResult[] = [];
    initialize = async (imageURL: string, options: GeometrizeOptions = defaultOptions): Promise<Bitmap> => {
        return new Promise((resolve, reject) => {
            this.options = options
            Jimp.read(imageURL)
                .then(image => {
                    try {
                        // Get Image total pixel count
                        const totalPixels = image.bitmap.width * image.bitmap.height;
                        console.log("Original pixel count: ", totalPixels)
                        if (totalPixels > options.maxPixels) {
                            // Scaling internal image sample
                            const scale = Math.sqrt(totalPixels / options.maxPixels);
                            image.resize(Math.floor(image.bitmap.width / scale), Jimp.AUTO)
                        }

                        // save bitmap
                        this.bitMap = Bitmap.createFromByteArray(image.bitmap.width,
                            image.bitmap.height, image.bitmap.data)
                        this.runner = new ImageRunner(this.bitMap)

                        resolve(this.bitMap)
                    }
                    catch (e) {
                        reject(e)
                    }
                })
                .catch(e => {
                    reject(e)
                })
        })
    }
    setOptions = async (options: GeometrizeOptions) => {
        this.options = options;
    }
    getOPtions = async () => this.options
    step = async (steps: number = 1) => {
        if (this.options && this.runner) {
            const result = new Array<ShapeResult>();

            for (let step = 0; step < steps; step++) {
                result.push(this.runner!.step(this.options)[0])
            }
            this.shapes = [...this.shapes ?? [], ...result]

            return result.map(s => SvgExporter.exportShape(s))
        }
        else throw new Error("'step' was called before initializing!");
    }
    getShapesJSON = async () => this.shapes?.map(ShapeJsonExporter.exportShape) ?? []
    getShapesCompact = async (): Promise<CompactShapeRow[]> => {
        const out: CompactShapeRow[] = [];
        for (const s of this.shapes ?? []) {
            const jsonStr = ShapeJsonExporter.exportShape(s);
            let parsed: unknown;
            try { parsed = JSON.parse(jsonStr); } catch (_e) { continue; }
            const row = encodeFromShapeJson(parsed);
            if (row !== null) out.push(row);
        }
        return out;
    }

}