import React, { useMemo } from 'react';

// Positions are chosen once per mount; shapes never jump while typing or playing.
const GeometryBackdrop: React.FC<{ seed?: number }> = ({ seed }) => {
  const shapes = useMemo(() => {
    let state = seed == null ? Math.floor(Math.random() * 100000) : seed;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    return Array.from({ length: 13 }, (_, index) => ({ type: index % 5, x: 3 + random() * 94, y: 2 + random() * 94, size: 20 + random() * 65, rotation: Math.floor(random() * 180), delay: random() * -18, color: index % 4 }));
  }, [seed]);
  return <div className="geometry-backdrop" aria-hidden="true">{shapes.map((shape, index) => <svg key={index} className={`geometry-piece geometry-color-${shape.color}`} viewBox="0 0 100 100" style={{ left: `${shape.x}%`, top: `${shape.y}%`, width: shape.size, height: shape.size, transform: `rotate(${shape.rotation}deg)`, animationDelay: `${shape.delay}s` }} fill="none" stroke="currentColor" strokeWidth="5">{shape.type === 0 ? <circle cx="50" cy="50" r="35" /> : shape.type === 1 ? <path d="M50 10L90 82H10Z" /> : shape.type === 2 ? <rect x="18" y="18" width="64" height="64" rx="10" /> : shape.type === 3 ? <path d="M15 50H85M50 15V85" strokeLinecap="round" /> : <path d="M15 70Q50 5 85 70" strokeLinecap="round" />}</svg>)}</div>;
};
export default GeometryBackdrop;
