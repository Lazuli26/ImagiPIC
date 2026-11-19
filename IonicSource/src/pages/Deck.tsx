import { IonButton, IonIcon, IonToast, IonAlert } from '@ionic/react';
import { addOutline, imagesOutline, arrowForwardOutline, trashOutline, closeOutline } from 'ionicons/icons';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import BasicPage from '../components/BasicPage';
import { UserAuthContext } from '../App';
import { useDeck } from '../game/useDeck';
import { deleteDeckImage, deleteDeckImages, renameDeckImage } from '../game/deckOperations';
import DeckBuilderModal from '../components/DeckBuilderModal';
import DeckImagePreviewModal from '../components/DeckImagePreviewModal';
import { AnimatedShapeThumbnail } from '../components/showcase/ShapeShowcase';
import type { DeckImageDoc } from '../types/database';

const Deck: React.FC = () => {
  const ownerUid = useContext(UserAuthContext)?.user.uid || '';
  const { images, meta, optimisticallyRemove, optimisticallyAdd } = useDeck(ownerUid);
  const count = meta?.count ?? images.length;
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<DeckImageDoc | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const selection = useMemo(() => new Set(selectedIds), [selectedIds]);
  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);
  const filtered = useMemo(() => images.filter(image => (image.label || 'Sin título').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [images, search]);
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }, []);
  const clearLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const handleCardClick = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (event.ctrlKey || event.metaKey || selectedIds.length > 0) { toggleSelected(id); return; }
    const image = images.find(entry => entry.id === id);
    if (image) setSelected(image);
  };
  const handleLongPressStart = (id: string, pointerType: string) => {
    if (pointerType !== 'touch') return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => { suppressClick.current = true; toggleSelected(id); longPressTimer.current = null; }, 500);
  };
  const remove = async (id: string) => {
    if (!ownerUid || deletingId) return;
    setDeletingId(id); setError('');
    try { await deleteDeckImage(ownerUid, id); optimisticallyRemove(id); setSelected(null); setToast('Imagen eliminada de tu mazo.'); }
    catch { setError('No se pudo eliminar la imagen. Comprueba tu conexión e inténtalo de nuevo.'); }
    finally { setDeletingId(null); }
  };
  const removeSelected = async () => {
    if (!ownerUid || deletingId || selectedIds.length === 0) return;
    const ids = [...selectedIds];
    setDeletingId('bulk'); setError('');
    try {
      await deleteDeckImages(ownerUid, ids);
      ids.forEach(optimisticallyRemove);
      setSelectedIds([]); setToast(`${ids.length} ${ids.length === 1 ? 'imagen eliminada' : 'imágenes eliminadas'} de tu mazo.`);
    } catch {
      setError('No se pudieron eliminar las imágenes. Comprueba tu conexión e inténtalo de nuevo.');
    } finally { setDeletingId(null); setConfirmBulkDelete(false); }
  };
  const saveRename = async (id: string, label: string) => {
    await renameDeckImage(ownerUid, id, label);
    setToast('Nombre actualizado.');
  };
  return <BasicPage title="Mi mazo"><div className="page-shell">
    <div className="page-heading"><div><span className="page-eyebrow">TU COLECCIÓN DE IDEAS</span><h1>Una imagen, mil posibilidades.</h1><p>Convierte tus fotos en pequeñas obras geométricas. Guárdalas aquí y sorprende al grupo cuando te toque presentar.</p></div><IonButton size="large" onClick={() => setAddOpen(true)} disabled={count >= 50}><IonIcon slot="start" icon={addOutline} />Añadir imagen</IonButton></div>
    <div className="deck-toolbar"><p><strong>{count} / 50</strong> imágenes · Tu próxima partida empieza aquí.</p><div className="deck-toolbar-actions">{images.length > 0 && <label className="deck-search"><IonIcon icon={imagesOutline} /><input type="search" aria-label="Buscar imágenes en mi mazo" placeholder="Busca una imagen…" value={search} onChange={e => setSearch(e.target.value)} /></label>}{selectedIds.length > 0 && <><span className="deck-selection-count">{selectedIds.length} seleccionadas</span><IonButton color="danger" fill="outline" onClick={() => setConfirmBulkDelete(true)} disabled={!!deletingId}><IonIcon slot="start" icon={trashOutline} />Eliminar</IonButton><IonButton fill="clear" onClick={() => setSelectedIds([])} aria-label="Cancelar selección"><IonIcon slot="icon-only" icon={closeOutline} /></IonButton></>}</div></div>
    {images.length > 0 && <p className="deck-selection-help">Mantén pulsada una carta en móvil o usa Ctrl / ⌘ + clic para seleccionar varias.</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
    {images.length === 0 ? <section className="surface-card empty-state"><svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><rect x="25" y="18" width="75" height="82" rx="16" fill="var(--app-tint)" transform="rotate(12 62 60)"/><rect x="15" y="21" width="75" height="82" rx="16" fill="var(--app-surface)" stroke="var(--app-lilac)" strokeWidth="2"/><circle cx="65" cy="44" r="9" fill="var(--app-peach)"/><path d="M25 84l22-31 16 19 12-12 8 24H25z" fill="var(--app-lilac)"/><path d="M94 12v14m-7-7h14" stroke="var(--app-mint)" strokeWidth="3" strokeLinecap="round"/></svg><h2>Un lienzo lleno de posibilidades.</h2><p>Empieza con una foto, una ilustración o algo que te haga sonreír. Nosotros ponemos las formas; tú pones la idea.</p><IonButton size="large" onClick={() => setAddOpen(true)}><IonIcon slot="start" icon={addOutline} />Crear mi primera imagen</IonButton></section> : filtered.length === 0 ? <section className="surface-card empty-state"><h2>No aparece por aquí.</h2><p>Prueba con otro nombre para encontrar tu imagen.</p><IonButton fill="outline" onClick={() => setSearch('')}>Ver todo mi mazo</IonButton></section> : <div className="deck-grid">{filtered.map(image => <button key={image.id} className={`deck-image-card${selection.has(image.id) ? ' is-selected' : ''}`} type="button" disabled={!!deletingId} onClick={event => handleCardClick(event, image.id)} onPointerDown={event => handleLongPressStart(image.id, event.pointerType)} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} onPointerCancel={clearLongPress} onContextMenu={event => event.preventDefault()} aria-pressed={selection.has(image.id)} aria-label={`${selection.has(image.id) ? 'Seleccionada. ' : ''}${image.label || 'Imagen sin título'}. ${selectedIds.length ? 'Pulsa para cambiar la selección.' : 'Pulsa para explorar; mantén pulsado para seleccionar.'}`}><div className="deck-thumbnail"><AnimatedShapeThumbnail image={image} /><span className="deck-select-mark" aria-hidden="true">✓</span><div className="deck-preview-overlay"><span>{selection.has(image.id) ? 'Seleccionada' : 'Explorar imagen'} <IonIcon icon={arrowForwardOutline} /></span></div></div><div className="deck-caption"><strong>{image.label || 'Sin título'}</strong><small>{image.shapeCount} formas · Lista para jugar</small></div></button>)}</div>}
    {images.length > 0 && <p className="deck-gallery-tip">Tus imágenes también pueden dar vida al inicio. Elige tus favoritas en «Personalizar muestra».</p>}
  </div><DeckBuilderModal ownerUid={ownerUid} isOpen={addOpen} onDismiss={() => setAddOpen(false)} onSaved={image => { optimisticallyAdd(image); setAddOpen(false); setToast('¡Nueva imagen lista para jugar!'); }} /><DeckImagePreviewModal imageDoc={selected} isOpen={selected !== null} onDismiss={() => setSelected(null)} onDelete={remove} onRename={saveRename} /><IonAlert isOpen={confirmBulkDelete} onDidDismiss={() => setConfirmBulkDelete(false)} header={`¿Eliminar ${selectedIds.length} ${selectedIds.length === 1 ? 'imagen' : 'imágenes'}?`} message="Se quitarán de tu mazo y no se pueden recuperar." buttons={[{ text: 'Conservar', role: 'cancel' }, { text: 'Eliminar', role: 'destructive', handler: removeSelected }]} /><IonToast isOpen={!!toast} onDidDismiss={() => setToast('')} message={toast} duration={2200} buttons={[{ text: 'Cerrar', role: 'cancel' }]} /></BasicPage>;
};
export { Deck };
export default Deck;
