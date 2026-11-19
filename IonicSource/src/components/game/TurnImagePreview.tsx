import { IonButton } from '@ionic/react';
import React, { useMemo, useState } from 'react';
import type { DeckImageDoc, ImageModifier } from '../../types/database';
import { decodeAllToSvgRows, unflattenShapes } from '../../utils/compactShapeCodec';
import { imageModifierFilter, seededShapeOrder } from '../../game/imageModifiers';
import ImageModifierControls from './ImageModifierControls';
import InlineSvgPreview from './InlineSvgPreview';

interface Props {
  image: DeckImageDoc;
  modifier: ImageModifier;
  onModifierChange: (modifier: ImageModifier) => void;
  onBack: () => void;
  onConfirm: () => void;
  busy: boolean;
}

const TurnImagePreview: React.FC<Props> = ({ image, modifier, onModifierChange, onBack, onConfirm, busy }) => {
  const [percent, setPercent] = useState(100);
  const rows = useMemo(() => decodeAllToSvgRows(
    unflattenShapes(image.shapesCompact).slice(0, image.shapeCount), image.width, image.height,
  ), [image]);
  const seed = modifier.type === 'shuffle' ? modifier.seed : undefined;
  const order = useMemo(() => seed === undefined ? undefined : seededShapeOrder(rows.length, seed), [rows.length, seed]);
  const validImage = rows.length > 0 && image.width > 0 && image.height > 0;
  return <section className="turn-image-preview ion-padding">
    <h2>{image.label || 'Vista previa de tu imagen'}</h2>
    <p className="game-hint">Solo tú puedes verla. Prueba cómo aparecerá y elige el modificador antes de compartirla.</p>
    <div className="turn-image-preview-canvas">
      <InlineSvgPreview shapes={rows} width={image.width} height={image.height}
        step={Math.max(1, Math.ceil(rows.length * percent / 100))} revealOrder={order} filter={imageModifierFilter(modifier)} />
    </div>
    <label className="preview-progress">Figuras visibles: {percent}%
      <input type="range" min="1" max="100" value={percent} disabled={busy} onChange={event => setPercent(Number(event.target.value))} />
    </label>
    <ImageModifierControls value={modifier} disabled={busy} onChange={onModifierChange} />
    {!validImage && <p role="alert" className="game-error">Esta imagen no tiene figuras disponibles. Elige otra imagen.</p>}
    <div className="turn-image-preview-actions">
      <IonButton fill="outline" disabled={busy} onClick={onBack}>Escoger otra imagen</IonButton>
      <IonButton disabled={busy || !validImage} onClick={onConfirm}>{busy ? 'Preparando el turno…' : 'Confirmar imagen y modificador'}</IonButton>
    </div>
  </section>;
};
export default TurnImagePreview;
