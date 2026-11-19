/* Real Ionic components with a local Firestore boundary. No production writes.
 * Requires Playwright + its WebKit browser (or PLAYWRIGHT_MODULE).
 * NODE_OPTIONS=--openssl-legacy-provider node scripts/test-mobile.cjs
 */
process.env.NODE_ENV = 'development';
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const webpack = require('webpack');
const { PNG } = require('pngjs');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'imagipic-mobile-'));

async function main() {
  const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    // Match react-scripts' browser build for Jimp's optional filesystem path.
    node: { fs: 'empty' },
    entry: path.join(__dirname, 'mobile-fixture.tsx'),
    output: { path: output, filename: 'fixture.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'], modules: [path.join(root, 'node_modules'), 'node_modules'] },
    module: { rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: {
        babelrc: false, configFile: false, presets: [[require.resolve('babel-preset-react-app'), { runtime: 'classic' }]],
      } } },
      { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [new webpack.NormalModuleReplacementPlugin(
      /(?:firebase\/firestore|firebase\/firebaseApp|game\/watchDocument|game\/useGuesses|game\/deckOperations)$/,
      path.join(__dirname, 'mobile-fixture-api.ts'),
    ), new webpack.NormalModuleReplacementPlugin(
      /GeometrizePlayer\.tsx\/GeoPlayer$/, path.join(__dirname, 'editor-fixture-engine.tsx'),
    ), new webpack.NormalModuleReplacementPlugin(
      /utils\/googleProgrammableSearch$/, path.join(__dirname, 'editor-fixture-search.ts'),
    ), ...(process.env.REAL_STYLE_PREVIEW ? [] : [new webpack.NormalModuleReplacementPlugin(
      /assets\/libraries\/Geometrize\/GeometrizeController$/, path.join(__dirname, 'editor-fixture-engine.tsx'),
    )])],
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true, errorDetails: true, children: true })));
    else resolve();
  }));
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    } else {
      const file = path.join(output, path.basename(req.url));
      if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(file));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const engine of (process.env.BROWSER_ENGINES || 'chromium,webkit').split(',')) {
      const browser = await playwright[engine].launch(engine === 'chromium' && process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH } : engine === 'webkit' && process.env.WEBKIT_PATH
          ? { executablePath: process.env.WEBKIT_PATH } : {});
      try {
        for (const width of (process.env.TEST_WIDTHS || '320,390,430,1280').split(',').map(Number)) {
          const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(`http://127.0.0.1:${server.address().port}/`);
          const input = page.getByLabel('Tu respuesta');
          await input.waitFor({ state: 'visible' });
          await input.fill('un avion');
          await input.evaluate(element => {
            window.savedInput = element;
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            element.value = 'un avión 🛩️'; element.setSelectionRange(5, 5);
            window.fixtureViewport = (height, top) => {
              Object.defineProperty(visualViewport, 'height', { configurable: true, value: height });
              Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: top });
              visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll'));
            };
            window.fixtureViewport(400, 40);
          });
          await page.waitForFunction(() => document.querySelector('.game-room').style.getPropertyValue('--room-viewport-height') === '400px');
          // Let the 500ms game clock rerender while the keyboard owns the buffer.
          await page.waitForTimeout(650);
          assert.equal(await input.inputValue(), 'un avión 🛩️');
          assert.equal(await input.evaluate(element => element.selectionStart), 5);
          const bounds = await input.boundingBox();
          assert(bounds.y >= 40 && bounds.y + bounds.height <= 441, `${engine}/${width}: input hidden by keyboard ${JSON.stringify(bounds)}`);
          const send = await page.getByText('Enviar', { exact: true }).boundingBox();
          assert(send.y + send.height <= 441, `${engine}/${width}: send button hidden`);
          assert.equal(await page.locator('ion-content').first().evaluate(element => getComputedStyle(element).getPropertyValue('--keyboard-offset').trim()), '0px');
          await page.screenshot({ path: path.join(output, `${engine}-${width}-keyboard.png`) });
          await input.press('Enter');
          assert.equal(await page.evaluate(() => window.fixture.answers.length), 0);
          await input.evaluate(element => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: element.value })));

          // Cross the desktop breakpoint without remounting the input or SVG.
          await page.evaluate(() => window.fixtureViewport(500, 0));
          await page.setViewportSize({ width: 1000, height: 500 });
          await page.waitForFunction(() => document.querySelector('.turn-playback').style.flexDirection === 'row');
          assert(await input.evaluate(element => element === window.savedInput));
          assert.equal(await input.inputValue(), 'un avión 🛩️');
          await page.setViewportSize({ width, height: 844 });
          await page.evaluate(() => window.fixtureViewport(844, 0));
          await page.waitForFunction(width => document.querySelector('.turn-playback').style.flexDirection === (width >= 1200 ? 'row' : 'column'), width);
          await input.press('End');
          await input.press('Enter');
          await page.waitForFunction(() => window.fixture.answers.length === 1);
          assert.equal(await page.evaluate(() => window.fixture.answers[0].textRaw), 'un avión 🛩️');
          assert.equal(await input.inputValue(), '');
          await page.getByText('un avión 🛩️', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });

          await page.evaluate(() => window.fixture.step(9));
          await page.waitForFunction(() => document.querySelector('svg.geometric-image').children.length === 9);
          const tags = await page.locator('svg.geometric-image').evaluate(svg => Array.from(svg.children).map(node => {
            if (node.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Non-SVG shape');
            return node.tagName.toLowerCase();
          }));
          assert.deepEqual(tags, ['rect', 'rect', 'rect', 'polygon', 'circle', 'rect', 'ellipse', 'line', 'path']);
          const svg = page.locator('svg.geometric-image');
          const imageBounds = await svg.boundingBox();
          const artBounds = await page.locator('.turn-playback-art').boundingBox();
          assert(imageBounds.y >= artBounds.y && imageBounds.y + imageBounds.height <= artBounds.y + artBounds.height + 1, `${engine}/${width}: image is clipped`);
          const light = await svg.screenshot();
          await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; });
          const dark = await svg.screenshot();
          fs.writeFileSync(path.join(output, `${engine}-${width}-light.png`), light);
          fs.writeFileSync(path.join(output, `${engine}-${width}-dark.png`), dark);
          const png = PNG.sync.read(light);
          const darkPng = PNG.sync.read(dark);
          assert.equal(png.width, darkPng.width); assert.equal(png.height, darkPng.height);
          // The rounded container's clipped corners expose the themed page.
          for (let y = 18; y < png.height - 18; y++) for (let x = 18; x < png.width - 18; x++) {
            const offset = (y * png.width + x) * 4;
            assert(png.data.slice(offset, offset + 4).equals(darkPng.data.slice(offset, offset + 4)), `${engine}/${width}: artwork changed with theme at ${x},${y}`);
          }
          for (const [x, y, expected] of [[10, 10, [255, 0, 0]], [35, 10, [127, 0, 128]], [60, 10, [127, 127, 255]], [10, 55, [0, 255, 0]]]) {
            const offset = (Math.floor(y * png.height / 100) * png.width + Math.floor(x * png.width / 100)) * 4;
            const actual = [...png.data.slice(offset, offset + 3)];
            assert(actual.every((channel, i) => Math.abs(channel - expected[i]) <= 1), `${engine}/${width}: pixel ${x},${y}: ${actual} != ${expected}`);
          }
          await page.screenshot({ path: path.join(output, `${engine}-${width}.png`) });

          // Real judge setup: complete private preview, exclusive modifiers,
          // native slider, filtered pixels, and synchronized seeded playback.
          await page.evaluate(() => window.fixture.setup());
          await page.getByText('Imagen de prueba', { exact: true }).click();
          const privateSvg = page.locator('.turn-image-preview svg');
          assert.equal(await privateSvg.locator(':scope > *').count(), 9);
          await page.getByLabel('Hue shift', { exact: true }).check();
          await page.getByLabel(/Cambio de tono/).focus();
          await page.getByLabel(/Cambio de tono/).press('End');
          await page.waitForFunction(() => document.querySelector('.turn-image-preview svg').style.filter === 'hue-rotate(180deg)');
          const shifted = PNG.sync.read(await privateSvg.screenshot());
          const shiftedOffset = (Math.floor(10 * shifted.height / 100) * shifted.width + Math.floor(10 * shifted.width / 100)) * 4;
          const shiftedRed = [...shifted.data.slice(shiftedOffset, shiftedOffset + 3)];
          assert(shiftedRed[1] > 90 && shiftedRed[2] > 90, `${engine}/${width}: hue slider did not recolor the red shape: ${shiftedRed}`);
          await page.getByLabel('Blanco y negro', { exact: true }).check();
          const gray = PNG.sync.read(await privateSvg.screenshot());
          for (let y = 18; y < gray.height - 18; y++) for (let x = 18; x < gray.width - 18; x++) {
            const offset = (y * gray.width + x) * 4;
            assert(Math.abs(gray.data[offset] - gray.data[offset + 1]) <= 1 && Math.abs(gray.data[offset] - gray.data[offset + 2]) <= 1,
              `${engine}/${width}: grayscale pixel still has color at ${x},${y}`);
          }
          assert.equal(await page.locator('input[name="image-modifier"]:checked').count(), 1);
          await page.getByLabel('Shuffle', { exact: true }).check();
          await page.getByLabel('Semilla de Shuffle', { exact: true }).fill('mis-figuras');
          assert.equal(await privateSvg.evaluate(element => element.style.filter), '');
          assert.equal(await page.evaluate(() => window.fixture.currentRound.imageModifier), undefined);
          await page.screenshot({ path: path.join(output, `${engine}-${width}-judge-shuffle.png`) });
          await page.getByText('Escoger otra imagen', { exact: true }).click();
          await page.waitForFunction(() => !document.querySelector('.turn-image-preview'));
          assert.equal(await page.evaluate(() => window.fixture.currentRound.imageModifier), undefined);
          await page.getByText('Volver a la sala', { exact: true }).click();
          await page.waitForFunction(() => document.querySelectorAll('ion-modal:not(.overlay-hidden)').length === 0);
          await page.evaluate(() => window.fixture.setup());
          await page.getByText('Imagen de prueba', { exact: true }).click();
          await page.getByLabel('Shuffle', { exact: true }).check();
          await page.getByLabel('Semilla de Shuffle', { exact: true }).fill('mis-figuras');
          await page.getByRole('button', { name: 'Confirmar imagen y modificador' }).click();
          await page.waitForFunction(() => document.querySelectorAll('ion-modal:not(.overlay-hidden)').length === 0);
          assert.deepEqual(await page.evaluate(() => window.fixture.currentRound.imageModifier), { type: 'shuffle', seed: 'mis-figuras' });
          const judgeImage = page.locator('.judge-art-stage svg.geometric-image');
          const imageBeforeToggle = await judgeImage.innerHTML();
          const controlsBox = await page.locator('.judge-action-bar').boundingBox();
          const stageBox = await page.locator('.judge-art-stage').boundingBox();
          assert(controlsBox.y >= stageBox.y && controlsBox.y + controlsBox.height <= stageBox.y + stageBox.height + 1, `${engine}/${width}: controls do not float within the image`);
          await page.getByRole('button', { name: 'Ocultar controles del juez', exact: true }).click();
          assert.equal(await page.locator('.judge-action-bar').count(), 0);
          assert.equal(await judgeImage.innerHTML(), imageBeforeToggle);
          await page.getByRole('button', { name: 'Mostrar controles del juez', exact: true }).click();
          await page.getByText('Permitir inicio sin esperar a todos', { exact: true }).click();
          await page.getByRole('button', { name: /Iniciar turno/ }).click();
          await page.waitForFunction(() => !document.querySelector('.image-modifiers'));
          await page.evaluate(() => window.fixture.step(5));
          await page.waitForFunction(() => document.querySelector('svg.geometric-image').children.length === 5);
          const judgeSelection = await svg.innerHTML();
          await page.evaluate(() => window.fixture.judge(false));
          assert.equal(await svg.innerHTML(), judgeSelection, `${engine}/${width}: clients selected different shapes`);
          // The judge sees each player's progress; reaching all-correct does
          // not change the round until the judge chooses the skip action.
          await page.evaluate(() => {
            window.fixture.judge(true);
            window.fixture.answers[0].verdict = 'CORRECT';
            window.dispatchEvent(new Event('fixture-answer'));
          });
          await page.getByText('¡Todos acertaron!', { exact: true }).waitFor();
          await page.waitForFunction(() => document.querySelector('.judge-guess-progress')?.textContent.includes('1 / 1 acertaron'));
          assert.equal(await page.evaluate(() => window.fixture.currentRound.state), 'IN_PROGRESS');
          await page.screenshot({ path: path.join(output, `${engine}-${width}-all-correct.png`) });
          await page.getByRole('button', { name: 'Saltar a los puntos' }).click();
          await page.waitForFunction(() => window.fixture.currentRound.state === 'ADJUDICATION_CLOSED');
          await page.evaluate(() => window.fixture.scoreboard());
          await page.getByRole('heading', { name: 'Así va la partida' }).waitFor();
          const scoreBox = await page.locator('.scores-card').boundingBox();
          if (width <= 760) {
            assert.equal(await page.getByRole('img', { name: 'Imagen completa del turno' }).count(), 0);
            assert(scoreBox.y >= 0 && scoreBox.y + scoreBox.height <= 844, `${engine}/${width}: standings not visible first`);
            await page.getByRole('button', { name: 'Ver imagen del turno', exact: true }).click();
            assert.equal(await page.getByRole('img', { name: 'Imagen completa del turno' }).count(), 1);
            await page.getByRole('button', { name: 'Ocultar imagen del turno', exact: true }).click();
          }
          await page.screenshot({ path: path.join(output, `${engine}-${width}-standings.png`) });

          // Search-first editor: real search form, image import, compact
          // controls, fixed footer, generation and save overlay dismissal.
          await page.evaluate(() => window.fixture.builder());
          const search = page.getByLabel('Qué imagen buscas en Google', { exact: true });
          await search.waitFor();
          await page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'search');
          assert.equal(await page.getByText(/Paso [1-4] de 4/).count(), 0);
          await page.screenshot({ path: path.join(output, `${engine}-${width}-editor-search.png`) });
          await search.fill('geometría');
          await page.getByRole('button', { name: 'Buscar', exact: true }).click();
          await page.getByRole('button', { name: 'Imagen de prueba de búsqueda' }).click();
          await page.getByRole('button', { name: 'Usar esta imagen', exact: true }).click();
          await page.getByText('Imagen preparada · 100 × 100 px', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Continuar →', exact: true }).click();
          await page.getByText('Ponle nombre a tu carta', { exact: false }).waitFor();
          await page.getByText('Vista previa de la mezcla', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Círculo', exact: true }).click();
          await page.waitForFunction(real => { const count = document.querySelector('.builder-style-preview svg')?.children.length || 0; return real ? count >= 24 : count === 3; }, !!process.env.REAL_STYLE_PREVIEW);
          await page.getByRole('button', { name: 'Ver original', exact: true }).click();
          assert.equal(await page.locator('.builder-style-preview img').count(), 1);
          await page.getByRole('button', { name: 'Ver mezcla', exact: true }).click();
          const scrollDelta = () => page.locator('.deck-builder-modal:not(.overlay-hidden) ion-content').evaluate(async content => {
            const scroll = await content.getScrollElement();
            return scroll.scrollHeight - scroll.clientHeight;
          });
          assert(await scrollDelta() <= 2, `${engine}/${width}: default editor requires scrolling`);
          const create = page.getByRole('button', { name: 'Crear formas', exact: true });
          const createBounds = await create.boundingBox();
          assert(createBounds.y >= 0 && createBounds.y + createBounds.height <= 844, `${engine}/${width}: create button outside viewport`);
          await page.getByLabel('Nombre de la carta').fill('Mi primera carta');
          await page.screenshot({ path: path.join(output, `${engine}-${width}-editor-create.png`) });
          await create.click();
          await page.getByRole('button', { name: 'Guardar carta', exact: true }).waitFor();
          assert(await scrollDelta() <= 2, `${engine}/${width}: completed editor requires scrolling`);
          await page.getByRole('button', { name: 'Guardar carta', exact: true }).click();
          await page.getByText('Carta guardada en la prueba', { exact: true }).waitFor();
          await page.waitForFunction(() => document.querySelectorAll('ion-modal:not(.overlay-hidden)').length === 0);
          // Joining uses the real Ionic overlay lifecycle, then the destination
          // stays interactive without a reload or lingering backdrop.
          await page.evaluate(() => window.fixture.join());
          const code = page.locator('ion-modal input').first();
          await code.fill('ABC234');
          await page.getByRole('button', { name: 'Entrar a la sala', exact: true }).click();
          try { await page.getByRole('heading', { name: 'Sala ABC234' }).waitFor({ timeout: 5000 }); }
          catch (error) {
            console.error('Join state:', await page.evaluate(() => ({ text: document.body.innerText, modals: Array.from(document.querySelectorAll('ion-modal')).map(modal => ({ isOpen: modal.isOpen, canDismiss: modal.canDismiss, presented: modal.presented, classes: modal.className })) })));
            throw error;
          }
          await page.getByRole('button', { name: 'Comprobar sala' }).click();
          await page.getByText('Interacciones: 1', { exact: true }).waitFor();
          assert.equal(await page.locator('ion-modal:not(.overlay-hidden)').count(), 0);
          assert.deepEqual(errors, [], `${engine}/${width}: browser errors`);
          console.log(`PASS ${engine} ${width}px: keyboard/IME, SVG colors, judge picker dismissal after early snapshot, optional all-correct skip, search-first editor without scroll, save and join overlays`);
          await context.close();
        }
      } finally { await browser.close(); }
    }
    console.log(`Screenshots: ${output}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
