import { IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonRange, IonAlert, IonIcon, IonInput } from '@ionic/react';
import { trashOutline, imagesOutline, createOutline, checkmarkOutline } from 'ionicons/icons';
import React, { useEffect, useMemo, useState } from 'react';
import type { DeckImageDoc } from '../types/database';
import { decodeAllToSvgRows, unflattenShapes } from '../utils/compactShapeCodec';

interface DeckImagePreviewModalProps { imageDoc: DeckImageDoc | null; isOpen: boolean; onDismiss: () => void; onDelete: (id: string) => void; onRename: (id: string, label: string) => Promise<void>; }
const DeckImagePreviewModal: React.FC<DeckImagePreviewModalProps> = ({ imageDoc, isOpen, onDismiss, onDelete, onRename }) => {
  const [cursor, setCursor] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [label, setLabel] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelError, setLabelError] = useState('');
  useEffect(() => { if (isOpen) { setCursor(imageDoc?.shapeCount || 0); setLabel(imageDoc?.label || ''); setLabelError(''); } }, [isOpen, imageDoc?.id, imageDoc?.shapeCount, imageDoc?.label]);
  const rows = useMemo(() => imageDoc ? decodeAllToSvgRows(unflattenShapes(imageDoc.shapesCompact), imageDoc.width, imageDoc.height) : [], [imageDoc]);
  const saveLabel = async () => {
    if (!imageDoc) return;
    setSavingLabel(true); setLabelError('');
    try { await onRename(imageDoc.id, label); }
    catch { setLabelError('No se pudo guardar el nombre. Inténtalo de nuevo.'); }
    finally { setSavingLabel(false); }
  };
  return <><IonModal className="deck-image-modal" isOpen={isOpen} onDidDismiss={onDismiss}><IonHeader><IonToolbar><IonTitle>Explora tu imagen</IonTitle><IonButtons slot="end"><IonButton onClick={onDismiss}>Cerrar</IonButton></IonButtons></IonToolbar></IonHeader><IonContent>{imageDoc && <div className="deck-image-detail"><div className="deck-detail-canvas"><svg className="geometric-image" viewBox={`0 0 ${imageDoc.width} ${imageDoc.height}`} role="img" aria-label={label || 'Imagen geométrica de tu mazo'} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: rows.slice(0, cursor).join('') }} /></div><div className="deck-detail-info"><span className="page-eyebrow">LISTA PARA SORPRENDER</span><h1>{label.trim() || 'Una idea sin título'}</h1><div className="deck-rename"><IonInput aria-label="Nombre de la carta" placeholder="Ponle un nombre" value={label} maxlength={80} onIonChange={event => setLabel(String(event.detail.value ?? ''))} /><IonButton onClick={saveLabel} disabled={savingLabel || label.trim() === (imageDoc.label || '')}><IonIcon slot="start" icon={savingLabel ? createOutline : checkmarkOutline} />{savingLabel ? 'Guardando…' : 'Guardar nombre'}</IonButton>{labelError && <small role="alert">{labelError}</small>}</div><p>Desliza y vuelve a descubrir cómo unas pocas formas se convierten en algo más.</p><label className="deck-detail-slider">Forma a forma<IonRange aria-label="Formas visibles en la imagen" min={0} max={imageDoc.shapeCount} value={cursor} onIonChange={event => setCursor(Number(event.detail.value))} /><small>{cursor} de {imageDoc.shapeCount} formas</small></label><span className="subtle-chip"><IonIcon icon={imagesOutline} />{imageDoc.width} × {imageDoc.height} px</span>{imageDoc.imageSource && <p className="deck-source-credit">Imagen basada en <a href={imageDoc.imageSource.pageUrl} target="_blank" rel="noopener noreferrer">{imageDoc.imageSource.title}</a> de {imageDoc.imageSource.artist} · {imageDoc.imageSource.license}. <a href={imageDoc.imageSource.pageUrl} target="_blank" rel="noopener noreferrer">Fuente y licencia ↗</a></p>}<details className="deck-generation-details"><summary>Detalles de creación</summary><dl><dt>Opacidad</dt><dd>{imageDoc.options.alpha}/255</dd><dt>Candidatas por paso</dt><dd>{imageDoc.options.candidateShapesPerStep}</dd><dt>Ajustes por paso</dt><dd>{imageDoc.options.shapeMutationsPerStep}</dd></dl></details><div className="deck-delete-action"><IonButton fill="clear" color="danger" onClick={() => setConfirmDelete(true)}><IonIcon slot="start" icon={trashOutline} />Eliminar del mazo</IonButton></div></div></div>}</IonContent></IonModal><IonAlert isOpen={confirmDelete} onDidDismiss={() => setConfirmDelete(false)} header="¿Eliminar esta imagen?" message="La imagen se eliminará de tu mazo. Esta acción no se puede deshacer." buttons={[{ text: 'Conservar', role: 'cancel' }, { text: 'Eliminar imagen', role: 'destructive', handler: () => { if (imageDoc) onDelete(imageDoc.id); setConfirmDelete(false); } }]} /></>;
};
export default DeckImagePreviewModal;
export { DeckImagePreviewModal };
