import { downloadCommonsImage, searchCommonsImages } from './commonsImages';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('searches Commons files and keeps source credits', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ query: { pages: [{
      index: 1,
      title: 'File:Gato feliz.jpg',
      imageinfo: [{
        mime: 'image/jpeg',
        thumburl: 'https://thumb.wikimedia.org/gato.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Gato_feliz.jpg',
        extmetadata: {
          Artist: { value: '<a href="/wiki/User:Ana">Ana</a>' },
          LicenseShortName: { value: 'CC BY 4.0' },
        },
      }],
    }] } }),
  });
  const images = await searchCommonsImages('gato');
  expect(images).toEqual([{
    fileTitle: 'File:Gato feliz.jpg', title: 'Gato feliz',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Gato_feliz.jpg',
    thumbnailUrl: 'https://thumb.wikimedia.org/gato.jpg',
    artist: 'Ana', license: 'CC BY 4.0',
  }]);
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('gsrsearch=gato+filetype%3Abitmap');
});

test('downloads a processing-size image instead of the original', async () => {
  const blob = new Blob(['image-bytes'], { type: 'image/jpeg' });
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: [{ imageinfo: [{
      url: 'https://upload.wikimedia.org/original.jpg',
      thumburl: 'https://thumb.wikimedia.org/1280px-gato.jpg',
      mime: 'image/jpeg',
    }] }] } }) })
    .mockResolvedValueOnce({ ok: true, blob: async () => blob });
  const file = await downloadCommonsImage({
    fileTitle: 'File:Gato feliz.jpg', title: 'Gato feliz',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Gato_feliz.jpg',
    thumbnailUrl: 'https://thumb.wikimedia.org/gato.jpg',
    artist: 'Ana', license: 'CC BY 4.0',
  });
  expect(file.type).toBe('image/jpeg');
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('titles=File%3AGato+feliz.jpg');
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://thumb.wikimedia.org/1280px-gato.jpg');
});
