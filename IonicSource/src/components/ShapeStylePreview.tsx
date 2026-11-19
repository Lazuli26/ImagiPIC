import React, { useEffect, useState } from 'react';
import { GeometrizeController } from '../assets/libraries/Geometrize/GeometrizeController';
import { decodeAllToSvgRows, unflattenShapes } from '../utils/compactShapeCodec';
import InlineSvgPreview from './game/InlineSvgPreview';

interface Props {
  imageSrc: string;
  shapeTypes: number[];
  alpha: number;
  candidateShapesPerStep: number;
  shapeMutationsPerStep: number;
  maxPixels: number;
}

// A small, separate worker previews the selected mixture without starting or
// changing the full card generation. Cancel obsolete recipes as users edit.
const ShapeStylePreview: React.FC<Props> = ({ imageSrc, shapeTypes, alpha, candidateShapesPerStep, shapeMutationsPerStep, maxPixels }) => {
  const [preview, setPreview] = useState<{ rows: string[]; width: number; height: number } | null>(null);
  const [error, setError] = useState(false);
  const [original, setOriginal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let controller: GeometrizeController | null = null;
    setPreview(null); setError(false);
    if (!imageSrc || !shapeTypes.length) return;
    const timer = window.setTimeout(async () => {
      controller = new GeometrizeController();
      try {
        const bitmap = await controller.initialize(imageSrc, {
          shapeTypes, alpha,
          candidateShapesPerStep: Math.min(20, candidateShapesPerStep),
          shapeMutationsPerStep: Math.min(20, shapeMutationsPerStep),
          maxPixels: Math.min(16384, maxPixels),
        });
        if (cancelled) return;
        await controller.step(24);
        if (cancelled) return;
        const compact = await controller.getShapesCompact();
        if (!cancelled) setPreview({ rows: decodeAllToSvgRows(unflattenShapes(compact), bitmap.width, bitmap.height), width: bitmap.width, height: bitmap.height });
      } catch {
        if (!cancelled) setError(true);
      } finally { controller?.dispose(); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); controller?.dispose(); };
  }, [imageSrc, shapeTypes, alpha, candidateShapesPerStep, shapeMutationsPerStep, maxPixels]);

  return <div className="builder-style-preview">
    {preview && !original
      ? <InlineSvgPreview shapes={preview.rows} step={preview.rows.length} width={preview.width} height={preview.height} />
      : <img src={imageSrc} alt="Imagen original" />}
    <span className="builder-preview-caption" role="status">{original ? 'Imagen original' : preview ? 'Vista previa de la mezcla' : !shapeTypes.length ? 'Elige las figuras para ver la mezcla' : error ? 'Crea las formas para ver el resultado' : 'Combinando figuras…'}</span>
    <button type="button" className="builder-compare" aria-pressed={original} disabled={!preview} onClick={() => setOriginal(value => !value)}>{original ? 'Ver mezcla' : 'Ver original'}</button>
  </div>;
};

export default ShapeStylePreview;
