import { isString } from 'lodash'
import React, { FC } from 'react'
import './index.scss';

interface SvgRendererProps {
  shapes: string[] | string;
  width: number;
  height: number;
  maxWidth?: number | string;
  maxHeight?: number | string;
}

const SvgRenderer: FC<SvgRendererProps> = ({ shapes, width, height, maxWidth, maxHeight }) => {
  if (
    typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
    typeof height !== 'number' || !Number.isFinite(height) || height <= 0
  ) {
    return <></>;
  }
  const shapeHtml = isString(shapes) ? shapes : (Array.isArray(shapes) ? shapes.join('\n') : '');
  const viewBox = `0 0 ${width} ${height}`;
  return (
    <div
      className="svgViewPort"
      style={{
        width: '100%',
        maxWidth: maxWidth ?? '100%',
        maxHeight: maxHeight ?? '70vh',
        aspectRatio: `${width} / ${height}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
      }}
    >
      <div className="svgElement" style={{ width: '100%', height: '100%' }}>
        <svg
          className="geometric-image"
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid slice"
          dangerouslySetInnerHTML={{ __html: shapeHtml }}
        />
      </div>
    </div>
  );
}

export default SvgRenderer