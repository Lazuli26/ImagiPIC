import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadGoogleThumbnail, GoogleImageResult, loadGoogleProgrammableSearch, mountGoogleImageResults } from '../utils/googleProgrammableSearch';
import { ImageSourceCredit } from '../utils/commonsImages';

interface Props {
  engineId: string;
  onSelect: (file: File, source: ImageSourceCredit) => Promise<void>;
  disabled?: boolean;
  autoFocus?: boolean;
}

const GoogleImageSearch: React.FC<Props> = ({ engineId, onSelect, disabled = false, autoFocus = false }) => {
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [preview, setPreview] = useState<GoogleImageResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closePreviewRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<((query: string) => void) | null>(null);
  const selectionController = useRef<AbortController | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!preview) return;
    document.body.classList.add('imagipic-preview-open');
    closePreviewRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selectionController.current) setPreview(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('imagipic-preview-open');
      previousFocusRef.current?.focus();
    };
  }, [preview]);

  useEffect(() => {
    let active = true;
    let dispose: (() => void) | null = null;
    loadGoogleProgrammableSearch(engineId).then(() => {
      if (!active || !containerRef.current) return;
      const mounted = mountGoogleImageResults(containerRef.current, (result: GoogleImageResult) => {
        previousFocusRef.current = document.activeElement as HTMLElement;
        setPreview(result);
        setError('');
      });
      dispose = mounted.dispose;
      searchRef.current = mounted.search;
      setReady(true);
    }).catch(err => { if (active) setError(err.message || 'No se pudo cargar Google.'); });
    return () => {
      active = false;
      selectionController.current?.abort();
      dispose?.();
      searchRef.current = null;
    };
  }, [engineId]);

  const choosePreview = async () => {
    if (!preview || selectionController.current) return;
    const controller = new AbortController();
    selectionController.current = controller;
    setChoosing(true);
    setError('');
    try {
      const file = await downloadGoogleThumbnail(preview, controller.signal);
      if (controller.signal.aborted) return;
      await onSelectRef.current(file, {
        title: preview.title,
        pageUrl: preview.pageUrl,
        artist: new URL(preview.pageUrl).hostname,
        license: 'Consulta los derechos de uso en la fuente',
      });
      if (!controller.signal.aborted) setPreview(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message || 'No se pudo abrir esta imagen.');
    } finally {
      if (!controller.signal.aborted) setChoosing(false);
      if (selectionController.current === controller) selectionController.current = null;
    }
  };

  return <section className="commons-search google-search" aria-label="Buscar imágenes con Google">
    <div className="commons-search-heading">
      <h3>Buscar imágenes con Google</h3>
      <p>Encuentra memes, personajes e imágenes de los sitios incluidos en el buscador.</p>
    </div>
    <form className="commons-search-form" onSubmit={event => {
      event.preventDefault();
      if (!query.trim() || !searchRef.current) return;
      setError('');
      searchRef.current(query.trim());
    }}>
      <input type="search" autoFocus={autoFocus} aria-label="Qué imagen buscas en Google" placeholder="Por ejemplo: Drake meme, Pikachu…"
        value={query} onChange={event => setQuery(event.target.value)} maxLength={120} disabled={disabled || choosing} />
      <button type="submit" disabled={!ready || !query.trim() || disabled || choosing}>Buscar</button>
    </form>
    {!ready && !error && <p role="status">Cargando buscador de Google…</p>}
    {choosing && <p role="status">Preparando imagen…</p>}
    {error && !preview && <p className="commons-search-error" role="alert">{error}</p>}
    <div className="google-search-results" ref={containerRef} aria-busy={choosing} />
    <p className="commons-search-note">Los resultados dependen de los sitios configurados. Comprueba los derechos de cada imagen antes de compartirla.</p>
    {preview && createPortal(<div className="google-preview-backdrop" onClick={() => { if (!choosing) setPreview(null); }}>
      <div className="google-preview-dialog" role="dialog" aria-modal="true" aria-label={`Vista previa de ${preview.title}`} onClick={event => event.stopPropagation()}>
        <div className="google-preview-header">
          <h4>{preview.title}</h4>
          <button type="button" ref={closePreviewRef} aria-label="Cerrar vista previa" disabled={choosing} onClick={() => setPreview(null)}>×</button>
        </div>
        <div className="google-preview-image">
          <img src={preview.thumbnailUrl} alt={preview.title} />
        </div>
        <div className="google-preview-footer">
          <a href={preview.pageUrl} target="_blank" rel="noopener noreferrer">Ver página original ↗</a>
          <button type="button" disabled={choosing || disabled} onClick={choosePreview}>{choosing ? 'Preparando…' : 'Usar esta imagen'}</button>
        </div>
        {error && <p className="commons-search-error" role="alert">{error}</p>}
      </div>
    </div>, document.body)}
  </section>;
};

export default GoogleImageSearch;
