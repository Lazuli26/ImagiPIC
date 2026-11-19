// Deterministic search boundary; no third-party requests in browser regressions.
const thumbnailUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#6555db"/><circle cx="50" cy="50" r="30" fill="#ffd78b"/></svg>');
export const loadGoogleProgrammableSearch = async () => {};
export const mountGoogleImageResults = (container: HTMLElement, onSelect: (result: any) => void) => {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'Imagen de prueba de búsqueda';
  button.onclick = () => onSelect({ title: 'Geometría de prueba', thumbnailUrl, pageUrl: 'https://example.com/imagen' });
  return { search: () => container.replaceChildren(button), dispose: () => container.replaceChildren() };
};
export const downloadGoogleThumbnail = async () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 100;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#6555db'; context.fillRect(0, 0, 100, 100);
  context.fillStyle = '#ffd78b'; context.fillRect(20, 20, 60, 60);
  return new File([await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))], 'fixture.png', { type: 'image/png' });
};
