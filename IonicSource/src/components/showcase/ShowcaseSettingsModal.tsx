import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import React, { useEffect, useState } from 'react';
import type { DeckImageDoc } from '../../types/database';
import { ShowcaseSettings } from './collection';
import { ShapeThumbnail } from './ShapeShowcase';

const ShowcaseSettingsModal: React.FC<{ isOpen: boolean; onDismiss: () => void; settings: ShowcaseSettings; images: DeckImageDoc[]; onSave: (next: ShowcaseSettings) => void }> = ({ isOpen, onDismiss, settings, images, onSave }) => {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { if (isOpen) setDraft(settings); }, [isOpen, settings]);
  const validImages = images.filter(image => image.shapesCompact.length > 0);
  const selectedIds = draft.imageIds.filter(id => validImages.some(image => image.id === id));
  const toggleImage = (id: string) => setDraft(previous => {
    const existing = previous.imageIds.filter(value => validImages.some(image => image.id === value));
    return { ...previous, imageIds: existing.includes(id) ? existing.filter(value => value !== id) : [...existing, id].slice(0, 12) };
  });
  return <IonModal className="showcase-settings-modal" isOpen={isOpen} onDidDismiss={onDismiss}><IonHeader><IonToolbar><IonTitle>Tu galería de inicio</IonTitle><IonButtons slot="end"><IonButton onClick={onDismiss}>Cerrar</IonButton></IonButtons></IonToolbar></IonHeader><IonContent><div className="showcase-settings-content">
    <span className="page-eyebrow">DALE TU TOQUE</span><h2>¿Qué quieres ver al entrar?</h2><p>Las imágenes aparecerán poco a poco, igual que en una partida. Esta selección se guarda en este navegador para tu cuenta.</p>
    <fieldset className="collection-source"><legend>Colección</legend>{[{ id: 'gallery', title: 'Colección ImagiPIC', detail: 'Tres pequeñas historias para inspirarte.' }, { id: 'deck', title: 'Una selección de mi mazo', detail: 'Elige hasta 12 de tus propias imágenes.' }].map(option => <label key={option.id}><input type="radio" name="showcase-source" value={option.id} checked={draft.source === option.id} onChange={() => setDraft({ ...draft, source: option.id as 'gallery' | 'deck' })} /><span><strong>{option.title}</strong><small>{option.detail}</small></span></label>)}</fieldset>
    {draft.source === 'deck' && <>{!validImages.length ? <div className="collection-empty"><p>Tu mazo todavía no tiene imágenes. Añade algunas en «Mi mazo» y vuelve a elegir tus favoritas.</p></div> : <><p className="collection-selection-count">{selectedIds.length} / 12 seleccionadas</p><div className="collection-image-grid">{validImages.map(image => <label key={image.id} className={selectedIds.includes(image.id) ? 'is-selected' : ''}><input type="checkbox" checked={selectedIds.includes(image.id)} disabled={!selectedIds.includes(image.id) && selectedIds.length >= 12} onChange={() => toggleImage(image.id)} /><span className="collection-thumbnail"><ShapeThumbnail image={image} /></span><span>{image.label || 'Sin título'}</span></label>)}</div></>}</>}
    <label className="collection-speed"><span>Tiempo por imagen<small>Incluye una pausa para disfrutar el resultado.</small></span><select value={draft.durationSecs} onChange={e => setDraft({ ...draft, durationSecs: Number(e.target.value) })}>{[8, 12, 20].map(value => <option key={value} value={value}>{value} segundos</option>)}</select></label>
    <IonButton expand="block" size="large" disabled={draft.source === 'deck' && !selectedIds.length} onClick={() => { onSave({ ...draft, imageIds: selectedIds }); onDismiss(); }}>Guardar mi selección</IonButton>
  </div></IonContent></IonModal>;
};
export default ShowcaseSettingsModal;
