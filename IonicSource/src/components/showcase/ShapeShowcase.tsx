import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { pauseOutline, playOutline, arrowForwardOutline } from 'ionicons/icons';
import { decodeAllToSvgRows, unflattenShapes } from '../../utils/compactShapeCodec';
import { gallery, ShowcaseImage } from './collection';

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ShapeThumbnail: React.FC<{ image: ShowcaseImage }> = ({ image }) => {
  const rows = useMemo(() => decodeAllToSvgRows(unflattenShapes(image.shapesCompact), image.width, image.height), [image]);
  return <svg className="geometric-image" viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: rows.join('') }} />;
};
export const AnimatedShapeThumbnail: React.FC<{ image: ShowcaseImage }> = ({ image }) => {
  const rows = useMemo(() => decodeAllToSvgRows(unflattenShapes(image.shapesCompact), image.width, image.height), [image]);
  const [phase, setPhase] = useState(3);
  const [visible, setVisible] = useState(false);
  const element = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 })
      : null;
    if (element.current) observer?.observe(element.current);
    if (!observer) setVisible(true);
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!visible || media?.matches) { setPhase(3); return; }
    const phases = [0.14, 0.38, 0.68, 1];
    let index = 0;
    setPhase(0);
    const timer = window.setInterval(() => {
      index = (index + 1) % phases.length;
      setPhase(index);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [image.id, visible]);
  const phaseLimits = [0.14, 0.38, 0.68, 1];
  const shapeCount = phaseLimits[phase] === 1 ? rows.length : Math.max(1, Math.ceil(rows.length * phaseLimits[phase]));
  return <svg className="geometric-image" ref={element} viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: rows.slice(0, shapeCount).join('') }} />;
};
const ShapeShowcase: React.FC<{ images?: ShowcaseImage[]; durationSecs?: number; suspended?: boolean }> = ({ images = gallery, durationSecs = 12, suspended = false }) => {
  const collection = images.length ? images : gallery;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [progress, setProgress] = useState(() => reducedMotion() ? 1 : .08);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const element = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const image = collection[index % collection.length];
  const rows = useMemo(() => decodeAllToSvgRows(unflattenShapes(image.shapesCompact), image.width, image.height), [image]);
  const collectionId = collection.map(entry => entry.id).join(':');
  useEffect(() => { setIndex(0); elapsed.current = 0; setProgress(reducedMotion() ? 1 : .08); }, [collectionId]);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .05 }) : null;
    if (element.current) observer?.observe(element.current);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const motionChanged = () => { if (media?.matches) { setPlaying(false); setProgress(1); } };
    if (media?.addEventListener) media.addEventListener('change', motionChanged); else media?.addListener(motionChanged);
    return () => { document.removeEventListener('visibilitychange', update); observer?.disconnect(); if (media?.removeEventListener) media.removeEventListener('change', motionChanged); else media?.removeListener(motionChanged); };
  }, []);
  useEffect(() => {
    if (!playing || !visible || !pageVisible || suspended) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); elapsed.current += now - last; last = now;
      const duration = durationSecs * 1000;
      if (elapsed.current >= duration) { elapsed.current = 0; setIndex(previous => (previous + 1) % collection.length); setProgress(.08); }
      else setProgress(Math.min(1, .08 + elapsed.current / (duration * .7)));
    }, 90);
    return () => window.clearInterval(timer);
  }, [playing, visible, pageVisible, suspended, collection.length, durationSecs, collectionId]);
  const select = (next: number) => { setIndex(next); elapsed.current = 0; setProgress(reducedMotion() ? 1 : .08); };
  const shapeCount = Math.min(rows.length, Math.max(1, Math.ceil(progress * rows.length)));
  return <div className="shape-showcase" ref={element}>
    <div className="showcase-orbit orbit-one" aria-hidden="true" /><div className="showcase-orbit orbit-two" aria-hidden="true" />
    <div className="showcase-label"><span className="live-dot" />Un mundo, forma a forma</div>
    <div className="showcase-art"><svg className="geometric-image" key={image.id} role="img" aria-label={`Muestra geométrica: ${image.label || 'Imagen de tu mazo'}`} viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: rows.slice(0, shapeCount).join('') }} /></div>
    <div className="showcase-caption"><span><small>¿Ya lo reconoces?</small><strong>{image.label || 'Una imagen de tu mazo'}</strong></span><span className="showcase-counter">{String(index % collection.length + 1).padStart(2, '0')}<small> / {String(collection.length).padStart(2, '0')}</small></span></div>
    <div className="showcase-controls"><div className="showcase-dots" aria-label="Imágenes de la muestra">{collection.map((entry, i) => <button type="button" key={entry.id} aria-label={`Mostrar ${entry.label || `imagen ${i + 1}`}`} aria-pressed={index % collection.length === i} onClick={() => select(i)} />)}</div><button type="button" className="icon-button" aria-label={playing ? 'Pausar muestra' : 'Reproducir muestra'} onClick={() => setPlaying(!playing)}><IonIcon icon={playing ? pauseOutline : playOutline} /></button><button type="button" className="icon-button" aria-label="Siguiente imagen de la muestra" onClick={() => select((index + 1) % collection.length)}><IonIcon icon={arrowForwardOutline} /></button></div>
  </div>;
};
export default ShapeShowcase;
