import { downloadGoogleThumbnail, loadGoogleProgrammableSearch, mountGoogleImageResults } from './googleProgrammableSearch';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  delete (window as any).google;
  delete (window as any).__gcse;
  document.querySelectorAll('script[src^="https://cse.google.com/cse.js"]').forEach(script => script.remove());
});

test('renders selectable image cards without the Google details popup', async () => {
  const loading = loadGoogleProgrammableSearch('engine-123');
  const script = document.querySelector('script[src^="https://cse.google.com/cse.js"]') as HTMLScriptElement;
  expect(script.src).toContain('cx=engine-123');
  (window as any).__gcse.initializationCallback();
  await loading;

  const execute = jest.fn();
  (window as any).google = { search: { cse: { element: {
    render: jest.fn(), getElement: () => ({ execute }),
  } } } };
  const container = document.createElement('div');
  const selected = jest.fn();
  const mounted = mountGoogleImageResults(container, selected);
  const name = ((window as any).google.search.cse.element.render as jest.Mock).mock.calls[0][0].gname;
  const resultsDiv = document.createElement('div');
  const handled = (window as any).__gcse.searchCallbacks.image.ready(name, 'gato', [], [{
    titleNoFormatting: 'Gato meme',
    image: { url: 'http://i.imgflip.com/gato.jpg' },
    contextUrl: 'https://imgflip.com/i/gato',
    thumbnailImage: { url: 'https://encrypted-tbn0.gstatic.com/images?q=gato' },
  }], resultsDiv);
  expect(handled).toBe(true);
  expect(resultsDiv.querySelectorAll('.google-result-card')).toHaveLength(1);
  expect((resultsDiv.querySelector('a') as HTMLAnchorElement).href).toBe('https://imgflip.com/i/gato');
  (resultsDiv.querySelector('button') as HTMLButtonElement).click();
  expect(selected).toHaveBeenCalledWith(expect.objectContaining({ title: 'Gato meme', thumbnailUrl: 'https://encrypted-tbn0.gstatic.com/images?q=gato' }));
  mounted.search('gato');
  expect(execute).toHaveBeenCalledWith('gato');
  mounted.dispose();
});

test('downloads the Google thumbnail, not the source image', async () => {
  const blob = new Blob(['thumbnail'], { type: 'image/jpeg' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => String(blob.size) }, blob: async () => blob });
  const result = {
    title: 'Gato',
    pageUrl: 'https://example.com/page',
    thumbnailUrl: 'https://encrypted-tbn0.gstatic.com/images?q=gato',
  };
  const file = await downloadGoogleThumbnail(result);
  expect(global.fetch).toHaveBeenCalledWith(result.thumbnailUrl, expect.objectContaining({ mode: 'cors', credentials: 'omit' }));
  expect(file.name).toBe('miniatura-google.jpg');
  expect(file.size).toBe(blob.size);
});

test('explains a blocked thumbnail request', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('CORS'));
  await expect(downloadGoogleThumbnail({
    title: 'Gato',
    pageUrl: 'https://example.com/page', thumbnailUrl: 'https://example.com/thumb.jpg',
  })).rejects.toThrow('No se pudo cargar la miniatura');
});
