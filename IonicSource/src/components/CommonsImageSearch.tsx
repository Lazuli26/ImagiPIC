import React, { useEffect, useRef, useState } from 'react';
import { CommonsImage, downloadCommonsImage, searchCommonsImages, ImageSourceCredit } from '../utils/commonsImages';

interface Props {
  onSelect: (file: File, source: ImageSourceCredit) => Promise<void>;
  disabled?: boolean;
  autoFocus?: boolean;
}

const CommonsImageSearch: React.FC<Props> = ({ onSelect, disabled = false, autoFocus = false }) => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [searchId, setSearchId] = useState(0);
  const [results, setResults] = useState<CommonsImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const selectionController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!submittedQuery) return;
    const controller = new AbortController();
    setSearching(true);
    setError('');
    setResults([]);
    searchCommonsImages(submittedQuery, controller.signal)
      .then(images => setResults(images))
      .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'No se pudo buscar.'); })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [submittedQuery, searchId]);

  useEffect(() => () => selectionController.current?.abort(), []);

  const choose = async (image: CommonsImage) => {
    if (choosing || disabled) return;
    const controller = new AbortController();
    selectionController.current = controller;
    setChoosing(image.fileTitle);
    setError('');
    try {
      const file = await downloadCommonsImage(image, controller.signal);
      if (!controller.signal.aborted) {
        await onSelect(file, {
          title: image.title,
          pageUrl: image.pageUrl,
          artist: image.artist,
          license: image.license,
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message || 'No se pudo abrir la imagen.');
    } finally {
      if (!controller.signal.aborted) setChoosing(null);
      if (selectionController.current === controller) selectionController.current = null;
    }
  };

  return <section className="commons-search" aria-label="Buscar imágenes en Wikimedia Commons">
    <div className="commons-search-heading">
      <h3>Buscar en Wikimedia Commons</h3>
      <p>Explora fotografías e ilustraciones de Wikimedia Commons sin salir de la app.</p>
    </div>
    <form className="commons-search-form" onSubmit={event => {
      event.preventDefault();
      if (query.trim()) {
        setSubmittedQuery(query.trim());
        setSearchId(id => id + 1);
      }
    }}>
      <input type="search" autoFocus={autoFocus} aria-label="Qué imagen buscas" placeholder="Por ejemplo: gato, montaña, café…"
        value={query} onChange={event => setQuery(event.target.value)} maxLength={120} disabled={disabled || !!choosing} />
      <button type="submit" disabled={!query.trim() || disabled || !!choosing || searching}>Buscar</button>
    </form>
    {searching && <p role="status">Buscando imágenes…</p>}
    {error && <p className="commons-search-error" role="alert">{error}</p>}
    {!searching && submittedQuery && !error && results.length === 0 && <p role="status">No encontramos imágenes compatibles. Prueba con otras palabras.</p>}
    {results.length > 0 && <div className="commons-results" aria-label="Resultados de imágenes">
      {results.map(image => <article className="commons-result" key={image.fileTitle}>
        <button type="button" onClick={() => choose(image)} disabled={disabled || !!choosing}
          aria-label={`Usar ${image.title}`}>
          <img src={image.thumbnailUrl} alt="" loading="lazy" />
          <span>{choosing === image.fileTitle ? 'Preparando…' : 'Usar imagen'}</span>
        </button>
        <div className="commons-result-credit">
          <strong title={image.title}>{image.title}</strong>
          <small>{image.artist} · {image.license}</small>
          <a href={image.pageUrl} target="_blank" rel="noopener noreferrer">Ver fuente y licencia ↗</a>
        </div>
      </article>)}
    </div>}
    <p className="commons-search-note">Revisa la licencia de la imagen antes de compartir tu carta.</p>
  </section>;
};

export default CommonsImageSearch;
