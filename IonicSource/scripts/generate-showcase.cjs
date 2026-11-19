// Rebuild the bundled gallery using the same Geometrize engine and codec as decks.
// Sources are original SVG artwork in showcase-sources/. Requires ImageMagick.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Jimp = require('jimp');
const { Bitmap, ImageRunner, ShapeTypes, ShapeJsonExporter } = require('geometrizejs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText, filename);
const { encodeFromShapeJson } = require('../src/utils/compactShapeCodec.ts');
const entries = [{ id: 'valley', label: 'Un respiro entre montañas' }, { id: 'balloon', label: 'Ideas que vuelan alto' }, { id: 'fox', label: 'Una mirada curiosa' }];
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'imagipic-showcase-'));
  try {
    const collection = [];
    for (const entry of entries) {
      const png = path.join(temp, `${entry.id}.png`);
      execFileSync('convert', [path.join(__dirname, 'showcase-sources', `${entry.id}.svg`), '-resize', '160x192!', png]);
      const image = await Jimp.read(png);
      const runner = new ImageRunner(Bitmap.createFromByteArray(image.bitmap.width, image.bitmap.height, image.bitmap.data));
      const shapesCompact = [];
      for (let i = 0; i < 230; i++) {
        const results = runner.step({ shapeTypes: [ShapeTypes.TRIANGLE, ShapeTypes.ROTATED_ELLIPSE], candidateShapesPerStep: 35, shapeMutationsPerStep: 40, alpha: 160 });
        for (const result of results) {
          const row = encodeFromShapeJson(JSON.parse(ShapeJsonExporter.exportShape(result)));
          if (row) shapesCompact.push(...row);
        }
      }
      collection.push({ ...entry, width: image.bitmap.width, height: image.bitmap.height, shapeCount: 230, shapesCompact });
      console.log(`Generated ${entry.id}: 230 engine shapes`);
    }
    fs.writeFileSync(path.join(__dirname, '../src/data/showcase/collection.json'), JSON.stringify(collection));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
