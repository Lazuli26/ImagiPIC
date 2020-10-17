import Jimp from 'jimp'
import { Bitmap, ImageRunner, ShapeTypes, SvgExporter } from 'geometrizejs'

export const RunGeometrize = async () => {
    debugger
    // load png/jpeg/gif,bmp/tiff image from url, file path or Buffer using jimp:
    const image = await Jimp.read('assets/images/Player1.png')
    const bitmap = Bitmap.createFromByteArray(image.bitmap.width,
        image.bitmap.height, image.bitmap.data)
    const runner = new ImageRunner(bitmap)
    const options = {
        shapeTypes: [ShapeTypes.CIRCLE, ShapeTypes.TRIANGLE],
        candidateShapesPerStep: 50,
        shapeMutationsPerStep: 100,
        alpha: 128
    }
    const iterations = 500
    const svgData = []
    for (let i = 0; i < iterations; i++) {
        svgData.push(SvgExporter.exportShapes(runner.step(options)))
    }
    const svg = SvgExporter.getSvgPrelude() +
        SvgExporter.getSvgNodeOpen(bitmap.width, bitmap.height) +
        svgData.join('\n') +
        SvgExporter.getSvgNodeClose()

    // in the browser:
    const container = document.getElementById('svg-container');
    if (container)
        container.innerHTML = svg;
}