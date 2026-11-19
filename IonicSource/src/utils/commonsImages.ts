export interface CommonsImage {
  fileTitle: string;
  title: string;
  pageUrl: string;
  thumbnailUrl: string;
  license: string;
  artist: string;
}

export interface ImageSourceCredit {
  title: string;
  pageUrl: string;
  license: string;
  artist: string;
}

const API_URL = 'https://commons.wikimedia.org/w/api.php';

function plainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const element = document.createElement('div');
  element.innerHTML = value;
  return (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function allowedImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (
      url.hostname === 'upload.wikimedia.org' || url.hostname === 'thumb.wikimedia.org'
    );
  } catch {
    return false;
  }
}

function apiUrl(params: Record<string, string>): string {
  const url = new URL(API_URL);
  Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export async function searchCommonsImages(term: string, signal?: AbortSignal): Promise<CommonsImage[]> {
  const query = term.trim().slice(0, 120);
  if (!query) return [];
  const response = await fetch(apiUrl({
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '16',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '360',
  }), { signal });
  if (!response.ok) throw new Error('No se pudo consultar Wikimedia Commons. Inténtalo de nuevo.');
  const data = await response.json();
  if (data.error) throw new Error('No se pudo consultar Wikimedia Commons. Inténtalo de nuevo.');
  const pages: any[] = Array.isArray(data.query?.pages) ? data.query.pages : [];
  return pages
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((page): CommonsImage | null => {
      const info = page.imageinfo?.[0];
      if (!info || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime) ||
          !allowedImageUrl(info.thumburl) || typeof info.descriptionurl !== 'string' ||
          !info.descriptionurl.startsWith('https://commons.wikimedia.org/')) return null;
      const metadata = info.extmetadata || {};
      return {
        fileTitle: String(page.title || ''),
        title: String(page.title || '').replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' '),
        pageUrl: info.descriptionurl,
        thumbnailUrl: info.thumburl,
        license: plainText(metadata.LicenseShortName?.value) || 'Ver licencia en Commons',
        artist: plainText(metadata.Artist?.value) || 'Autor en Commons',
      };
    })
    .filter((image): image is CommonsImage => image !== null);
}

export async function downloadCommonsImage(image: CommonsImage, signal?: AbortSignal): Promise<File> {
  const response = await fetch(apiUrl({
    titles: image.fileTitle,
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '1280',
  }), { signal });
  if (!response.ok) throw new Error('No se pudo preparar esa imagen. Elige otra o vuelve a intentarlo.');
  const data = await response.json();
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  const url = info?.thumburl || info?.url;
  if (!allowedImageUrl(url)) throw new Error('No se pudo preparar esa imagen. Elige otra o vuelve a intentarlo.');
  if (!info.thumburl && info.size > 20 * 1024 * 1024) throw new Error('Esa imagen es demasiado grande. Elige otra.');
  const imageResponse = await fetch(url, { signal });
  if (!imageResponse.ok) throw new Error('No se pudo descargar esa imagen. Elige otra o vuelve a intentarlo.');
  const blob = await imageResponse.blob();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || !blob.size || blob.size > 20 * 1024 * 1024) {
    throw new Error('El archivo recibido no es una imagen compatible.');
  }
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `commons-imagen.${extension}`, { type: blob.type });
}
