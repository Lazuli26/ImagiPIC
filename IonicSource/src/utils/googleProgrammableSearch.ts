export interface GoogleImageResult {
  title: string;
  pageUrl: string;
  thumbnailUrl: string;
}

type ResultHandler = (result: GoogleImageResult) => void;
const handlers = new Map<string, ResultHandler>();
let scriptPromise: Promise<void> | null = null;
let nextElementId = 0;

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function readResults(rawResults: any[]): Array<GoogleImageResult | null> {
  return rawResults.map(result => {
    const pageUrl = httpsUrl(result?.contextUrl || result?.url);
    const thumbnailUrl = httpsUrl(result?.thumbnailImage?.url);
    return pageUrl && thumbnailUrl ? {
      title: String(result.titleNoFormatting || result.title || 'Imagen').slice(0, 160),
      pageUrl,
      thumbnailUrl,
    } : null;
  });
}

function renderImageResults(name: string, rawResults: any[], promos: any[], container: HTMLElement): void {
  container.textContent = '';
  if (Array.isArray(promos)) {
    promos.forEach(promo => {
      const url = httpsUrl(promo?.url);
      if (!url) return;
      const link = document.createElement('a');
      link.className = 'google-result-promo';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = String(promo.title || 'Resultado destacado');
      container.appendChild(link);
    });
  }
  const results = readResults(Array.isArray(rawResults) ? rawResults : []).filter(
    (result): result is GoogleImageResult => result !== null,
  );
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'google-results-empty';
    empty.textContent = 'No se encontraron imágenes. Prueba con otras palabras.';
    container.appendChild(empty);
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'google-results-grid';
  results.forEach(result => {
    const card = document.createElement('article');
    card.className = 'google-result-card';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'google-result-select';
    button.setAttribute('aria-label', `Ver ${result.title}`);
    button.addEventListener('click', () => handlers.get(name)?.(result));
    const thumbnail = document.createElement('img');
    thumbnail.src = result.thumbnailUrl;
    thumbnail.alt = result.title;
    thumbnail.loading = 'lazy';
    button.appendChild(thumbnail);
    const action = document.createElement('span');
    action.className = 'google-result-action';
    action.textContent = 'Ver imagen';
    button.appendChild(action);

    const info = document.createElement('div');
    info.className = 'google-result-info';
    const title = document.createElement('strong');
    title.title = result.title;
    title.textContent = result.title;
    const source = document.createElement('a');
    source.href = result.pageUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = `Ver fuente · ${new URL(result.pageUrl).hostname.replace(/^www\./, '')} ↗`;
    info.append(title, source);
    card.append(button, info);
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

export function loadGoogleProgrammableSearch(engineId: string): Promise<void> {
  const googleWindow = window as any;
  if (googleWindow.google?.search?.cse?.element) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(engineId)}`;
    script.onerror = () => { scriptPromise = null; script.remove(); reject(new Error('No se pudo cargar el buscador de Google.')); };
    googleWindow.__gcse = {
      parsetags: 'explicit',
      initializationCallback: () => resolve(),
      searchCallbacks: {
        image: {
          ready: (name: string, _query: string, promos: any[], rawResults: any[], resultsDiv: HTMLElement) => {
            // Google still renders its navigation, page footer and branding.
            renderImageResults(name, rawResults, promos, resultsDiv);
            return true;
          },
        },
      },
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function mountGoogleImageResults(container: HTMLElement, onSelect: ResultHandler): {
  search: (query: string) => void;
  dispose: () => void;
} {
  const googleWindow = window as any;
  const elementApi = googleWindow.google?.search?.cse?.element;
  if (!elementApi) throw new Error('El buscador de Google todavía no está disponible.');
  const name = `imagipic-images-${++nextElementId}`;
  handlers.set(name, onSelect);
  elementApi.render({
    div: container,
    tag: 'searchresults-only',
    gname: name,
    attributes: {
      enableImageSearch: true,
      defaultToImageSearch: true,
      disableWebSearch: true,
      autoSearchOnLoad: false,
      safeSearch: 'active',
      imageSearchLayout: 'classic',
      imageSearchResultSetSize: '10',
    },
  });
  const element = elementApi.getElement(name);
  if (!element) {
    handlers.delete(name);
    throw new Error('No se pudo iniciar la búsqueda de imágenes. Activa la búsqueda de imágenes en el motor de Google.');
  }
  return {
    search: (query: string) => element.execute(query),
    dispose: () => { handlers.delete(name); },
  };
}

export async function downloadGoogleThumbnail(result: GoogleImageResult, signal?: AbortSignal): Promise<File> {
  const url = httpsUrl(result.thumbnailUrl);
  if (!url) throw new Error('La dirección de esta miniatura no es válida.');
  let response: Response;
  try {
    response = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new Error('No se pudo cargar la miniatura de Google. Prueba otra imagen.');
  }
  if (!response.ok) throw new Error('No se pudo descargar esta miniatura. Prueba otra imagen.');
  const length = Number(response.headers.get('content-length'));
  if (length > 20 * 1024 * 1024) throw new Error('Esta imagen supera el límite de 20 MB.');
  const blob = await response.blob();
  const types: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  const extension = types[blob.type];
  if (!extension || !blob.size || blob.size > 20 * 1024 * 1024) {
    throw new Error('El archivo recibido no es una imagen compatible de hasta 20 MB.');
  }
  return new File([blob], `miniatura-google.${extension}`, { type: blob.type });
}
