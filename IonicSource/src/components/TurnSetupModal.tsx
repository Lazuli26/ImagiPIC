import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonText,
  IonCard,
  IonCardSubtitle,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DeckImageDoc, CompactShapeType, ImageModifier } from '../types/database';
import { getDeckImages } from '../game/deckOperations';
import DeckBuilderModal from './DeckBuilderModal';
import TurnImagePreview from './game/TurnImagePreview';
import { NO_IMAGE_MODIFIER } from '../game/imageModifiers';
import {
  decodeAllToSvgRows,
  unflattenShapes,
} from '../utils/compactShapeCodec';

const COMPACT_TO_SYMBOL: Record<number, string> = {
  [CompactShapeType.ROTATED_RECTANGLE]: '▭',
  [CompactShapeType.ROTATED_ELLIPSE]: '⬭',
  [CompactShapeType.TRIANGLE]: '▲',
  [CompactShapeType.CIRCLE]: '●',
  [CompactShapeType.LINE]: '━',
  [CompactShapeType.QUADRATIC_BEZIER]: '⌒',
  [CompactShapeType.RECTANGLE]: '▬',
};

const SNAPSHOT_PERCENTS = [25, 50, 75, 100];

const InlineSvgPreview: React.FC<{
  shapes: string[];
  width: number;
  height: number;
}> = ({ shapes, width, height }) => {
  if (width <= 0 || height <= 0) return null;
  return (
    <svg
      className="geometric-image"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }}
      dangerouslySetInnerHTML={{ __html: shapes.join('\n') }}
    />
  );
};

interface TurnSetupModalProps {
  isOpen: boolean;
  judgeUid: string;
  currentUserUid: string;
  onSelectImage: (deckImage: DeckImageDoc, modifier: ImageModifier) => Promise<void>;
  onDismiss: () => void;
  ownerUid: string;
  // Owned by the parent (Room). Survives modal remounts caused by transient
  // currentRound/rounds snapshot churn, which otherwise reset local state and
  // re-open the modal right after the judge picks an image.
  selectionLocked: boolean;
}

interface DeckCardProps {
  imageDoc: DeckImageDoc;
  previewPhaseIndex: number;
  onClick: () => void;
}

const DeckCard: React.FC<DeckCardProps> = ({ imageDoc, previewPhaseIndex, onClick }) => {
  const snapshots = useMemo(() => {
    const rows = unflattenShapes(imageDoc.shapesCompact);
    const total = Math.max(0, Math.min(rows.length, imageDoc.shapeCount || rows.length));
    if (total <= 0 || imageDoc.width <= 0 || imageDoc.height <= 0) return [];
    const svgRows = decodeAllToSvgRows(rows.slice(0, total), imageDoc.width, imageDoc.height);
    return SNAPSHOT_PERCENTS.map((percent) => {
      const count = Math.max(1, Math.round((svgRows.length * percent) / 100));
      return {
        percent,
        shapes: svgRows.slice(0, count),
      };
    });
  }, [imageDoc]);

  const typeSymbols = imageDoc.options.shapeTypes
    .map((t) => COMPACT_TO_SYMBOL[t])
    .filter((v): v is string => !!v)
    .join('');

  return (
    <IonCard
      onClick={onClick}
      style={{
        cursor: 'pointer',
        margin: '8px',
        overflow: 'hidden',
        borderRadius: '18px',
        boxShadow: '0 10px 30px rgba(30, 35, 90, 0.08)',
      }}
      button
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          display: 'block',
          background: 'var(--app-inset)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {snapshots.length > 0 ? (
          <>
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 1,
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 7px',
                borderRadius: '999px',
                background: 'rgba(36, 36, 44, 0.78)',
                color: '#fff',
                letterSpacing: '0.02em',
              }}
            >
              {snapshots[previewPhaseIndex % snapshots.length].percent}%
            </div>
            <InlineSvgPreview
              shapes={snapshots[previewPhaseIndex % snapshots.length].shapes}
              width={imageDoc.width}
              height={imageDoc.height}
            />
          </>
        ) : imageDoc.previewDataUrl ? (
          <img
            src={imageDoc.previewDataUrl}
            alt={imageDoc.label || 'Deck preview'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            className="ion-text-center"
            style={{
              padding: '16px',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IonText color="medium" style={{ fontSize: '12px' }}>
              Vista previa no disponible
            </IonText>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 12px 12px 12px' }}>
        <IonCardSubtitle
          style={{
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '6px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {imageDoc.label || (
            <IonText color="medium"><em>Sin título</em></IonText>
          )}
        </IonCardSubtitle>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <IonBadge color="primary" style={{ fontSize: '10px' }}>
            {imageDoc.shapeCount}
          </IonBadge>
          {typeSymbols && (
            <IonBadge color="secondary" style={{ fontSize: '10px' }}>
              {typeSymbols}
            </IonBadge>
          )}
        </div>
      </div>
    </IonCard>
  );
};

const TurnSetupModal: React.FC<TurnSetupModalProps> = ({
  isOpen,
  judgeUid,
  currentUserUid,
  onSelectImage,
  onDismiss,
  ownerUid,
  selectionLocked,
}) => {
  const [deckImages, setDeckImages] = useState<DeckImageDoc[]>([]);
  const [deckError, setDeckError] = useState('');
  const [reload, setReload] = useState(0);
  const [loadingDeck, setLoadingDeck] = useState<boolean>(false);
  const [builderOpen, setBuilderOpen] = useState<boolean>(false);
  const [previewPhaseIndex, setPreviewPhaseIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<DeckImageDoc | null>(null);
  const [modifier, setModifier] = useState<ImageModifier>(NO_IMAGE_MODIFIER);
  const [submitting, setSubmitting] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const pending = useRef(false);
  const isJudge = currentUserUid === judgeUid;
  const modalOpen = isOpen && isJudge && !selectionLocked && !confirmed;

  useEffect(() => {
    setConfirmed(false);
    if (!isOpen) {
      setSelectedImage(null);
      setBuilderOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPreviewPhaseIndex((prev) => (prev + 1) % SNAPSHOT_PERCENTS.length);
    }, 1100);
    return () => window.clearInterval(intervalId);
  }, []);


  useEffect(() => {
    if (!modalOpen) {
      setDeckImages([]);
      return;
    }
    let cancelled = false;
    setLoadingDeck(true);
    setDeckError('');
    getDeckImages(ownerUid)
      .then((imgs) => {
        if (!cancelled) {
          setDeckImages(imgs);
        }
      })
      .catch(() => { if (!cancelled) setDeckError('No se pudo cargar tu mazo.'); })
      .finally(() => {
        if (!cancelled) setLoadingDeck(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modalOpen, ownerUid, reload]);

  const previewImage = (image: DeckImageDoc) => {
    setBuilderOpen(false);
    setSelectedImage(image);
    setModifier(NO_IMAGE_MODIFIER);
    setSelectionError('');
  };

  const confirmSelection = async () => {
    if (!selectedImage || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSelectionError('');
    try {
      await onSelectImage(selectedImage, modifier);
      setConfirmed(true);
    } catch {
      setSelectionError('No se pudo seleccionar la imagen. Inténtalo de nuevo.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <IonModal
        isOpen={modalOpen}
        onDidDismiss={() => { if (!pending.current && !selectionLocked) onDismiss(); }}
        className="turn-setup-modal"
        backdropDismiss={false}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton disabled={submitting} onClick={onDismiss}>Volver a la sala</IonButton>
            </IonButtons>
            <IonTitle>{selectedImage ? 'Vista previa' : 'Elige tu imagen'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {selectionError && <p role="alert" className="game-error ion-padding">{selectionError}</p>}
          {selectedImage ? <TurnImagePreview key={selectedImage.id} image={selectedImage} modifier={modifier}
            onModifierChange={setModifier} busy={submitting} onConfirm={confirmSelection}
            onBack={() => { setSelectedImage(null); setSelectionError(''); }} /> : loadingDeck ? (
            <div className="ion-text-center ion-padding">
              <IonSpinner /><p>Cargando tu mazo…</p>
            </div>
          ) : deckError ? (<div className="ion-padding ion-text-center"><p role="alert">{deckError}</p><IonButton onClick={() => setReload(reload + 1)}>Reintentar</IonButton></div>) : deckImages.length === 0 ? (
            <div className="ion-text-center ion-padding" style={{ padding: '48px 24px' }}>
              <IonText color="medium" style={{ fontSize: '16px', display: 'block', marginBottom: '16px' }}>
                Tu mazo está vacío. Añade una imagen para este turno.
              </IonText>
              <IonButton color="primary" onClick={() => setBuilderOpen(true)}>
                <IonIcon slot="start" icon={add} />
                Añadir imagen
              </IonButton>
            </div>
          ) : (
            <div style={{ padding: '8px 4px 4px 4px' }}>
              <IonGrid>
                <IonRow>
                  {deckImages.map((img) => (
                    <IonCol size="6" sizeMd="4" sizeLg="3" key={img.id}>
                      <DeckCard
                        imageDoc={img}
                        previewPhaseIndex={previewPhaseIndex}
                        onClick={() => previewImage(img)}
                      />
                    </IonCol>
                  ))}
                  <IonCol size="6" sizeMd="4" sizeLg="3">
                    <IonCard
                      onClick={() => setBuilderOpen(true)}
                      style={{
                        cursor: 'pointer',
                        margin: '8px',
                        overflow: 'hidden',
                        borderRadius: '18px',
                        boxShadow: '0 10px 30px rgba(30, 35, 90, 0.08)',
                        background: 'linear-gradient(135deg, rgba(56,128,255,0.06) 0%, rgba(162,89,255,0.06) 100%)',
                      }}
                      button
                    >
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          color: 'var(--ion-color-primary)',
                        }}
                      >
                        <div style={{ fontSize: '44px', lineHeight: 1 }}>＋</div>
                      </div>
                      <div style={{ padding: '8px 12px 12px 12px' }}>
                        <IonCardSubtitle
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            marginBottom: '6px',
                            textAlign: 'center',
                            color: 'var(--ion-color-primary)',
                          }}
                        >
                          Nueva imagen
                        </IonCardSubtitle>
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IonBadge color="light" style={{ fontSize: '10px', color: 'var(--ion-color-medium)' }}>
                            Geometrize
                          </IonBadge>
                        </div>
                      </div>
                    </IonCard>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </div>
          )}
        </IonContent>
      </IonModal>

      <DeckBuilderModal
        ownerUid={ownerUid}
        isOpen={builderOpen}
        onDismiss={() => setBuilderOpen(false)}
        onSaved={previewImage}
      />
    </>
  );
};

export default TurnSetupModal;
export { TurnSetupModal };
