import React, { useLayoutEffect, useRef } from 'react';

// Retain painted nodes, but parse additions as SVG/XML explicitly. HTML
// fragment parsing of self-closing shapes has differed between mobile engines.
const InlineSvgPreview = React.memo<{
  shapes: string[]; width: number; height: number; step: number;
  revealOrder?: number[]; filter?: string;
}>(({ shapes, width, height, step, revealOrder, filter }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const painted = useRef({ shapes, revealOrder, count: 0, nodes: [] as (Element | undefined)[] });
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const count = Math.max(0, Math.min(Math.floor(step), shapes.length));
    if (painted.current.shapes !== shapes || painted.current.revealOrder !== revealOrder || count < painted.current.count) {
      svg.textContent = '';
      painted.current = { shapes, revealOrder, count: 0, nodes: [] };
    }
    if (count > painted.current.count) {
      const indices = Array.from({ length: count - painted.current.count }, (_, offset) => {
        const index = painted.current.count + offset;
        return revealOrder ? revealOrder[index] : index;
      }).sort((a, b) => a - b);
      const parsed = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${indices.map(index => shapes[index]).join('\n')}</svg>`,
        'image/svg+xml',
      );
      if (parsed.querySelector('parsererror')) return;
      Array.from(parsed.documentElement.children).forEach((node, offset) => {
        const index = indices[offset];
        const imported = document.importNode(node, true);
        // Random selection changes when a shape appears, while its original
        // layer remains intact (including translucent overlapping shapes).
        const next = painted.current.nodes.slice(index + 1).find(Boolean);
        svg.insertBefore(imported, next || null);
        painted.current.nodes[index] = imported;
      });
      painted.current.count = count;
    }
  }, [shapes, step, revealOrder]);
  return <svg ref={svgRef} className="geometric-image" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    viewBox={`0 0 ${width > 0 ? width : 512} ${height > 0 ? height : 512}`}
    preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: '100%', filter }} />;
});

export default InlineSvgPreview;
