import React from 'react';
import { cleanup, render } from '@testing-library/react';
import InlineSvgPreview from './InlineSvgPreview';
import { decodeAllToSvgRows, encodeAllFromShapeJsonList } from '../../utils/compactShapeCodec';

afterEach(cleanup);

const shapes = encodeAllFromShapeJsonList([
  { type: 'RECTANGLE', color: [255, 255, 255, 255], data: [0, 0, 100, 100] },
  { type: 'ROTATED_RECTANGLE', color: [255, 0, 0, 128], data: [10, 20, 40, 60, 30] },
  { type: 'ROTATED_ELLIPSE', color: [0, 255, 0, 128], data: [30, 40, 10, 20, -45] },
  { type: 'TRIANGLE', color: [0, 0, 255, 255], data: [10, 10, 90, 10, 50, 80] },
  { type: 'CIRCLE', color: [255, 0, 255, 0], data: [50, 50, 10] },
  { type: 'LINE', color: [0, 255, 255, 100], data: [5, 10, 95, 90, 4] },
  { type: 'QUADRATIC_BEZIER', color: [0, 0, 0, 100], data: [0, 50, 50, 0, 100, 50, 2] },
]);
const rows = decodeAllToSvgRows(shapes, 100, 100);

test('shuffle reveals random selections in their original layers and retains painted nodes', () => {
  const revealOrder = [3, 1, 6, 0, 5, 2, 4];
  const view = render(<InlineSvgPreview shapes={rows} width={100} height={100} step={2} revealOrder={revealOrder} />);
  const svg = view.container.querySelector('svg')!;
  expect(Array.from(svg.children).map(node => node.tagName.toLowerCase())).toEqual(['rect', 'polygon']);
  const polygon = svg.querySelector('polygon');
  view.rerender(<InlineSvgPreview shapes={rows} width={100} height={100} step={4} revealOrder={revealOrder} />);
  expect(Array.from(svg.children).map(node => node.tagName.toLowerCase())).toEqual(['rect', 'rect', 'polygon', 'path']);
  expect(svg.querySelector('polygon')).toBe(polygon);
  view.rerender(<InlineSvgPreview shapes={rows} width={100} height={100} step={7} revealOrder={revealOrder} />);
  expect(Array.from(svg.children).map(node => node.tagName.toLowerCase())).toEqual(['rect', 'rect', 'ellipse', 'polygon', 'circle', 'line', 'path']);
  expect(svg.querySelector('polygon')).toBe(polygon);
  view.rerender(<InlineSvgPreview shapes={rows} width={100} height={100} step={2} revealOrder={revealOrder} />);
  expect(Array.from(svg.children).map(node => node.tagName.toLowerCase())).toEqual(['rect', 'polygon']);
});

test('all shape types remain ordered SVG siblings with their own colors, alpha, and rotation', () => {
  const view = render(<InlineSvgPreview shapes={rows} width={100} height={100} step={2} />);
  const first = view.container.querySelector('svg')!.firstElementChild;
  view.rerender(<InlineSvgPreview shapes={rows} width={100} height={100} step={7} />);
  const children = Array.from(view.container.querySelector('svg')!.children);
  expect(children.map(node => node.tagName.toLowerCase())).toEqual(['rect', 'rect', 'ellipse', 'polygon', 'circle', 'line', 'path']);
  expect(children.every(node => node.namespaceURI === 'http://www.w3.org/2000/svg')).toBe(true);
  expect(children[0]).toBe(first);
  expect(children[1].getAttribute('fill')).toBe('rgb(255, 0, 0)');
  expect(children[1].getAttribute('fill-opacity')).toBe('0.502');
  expect(children[1].getAttribute('transform')).toBe('rotate(30.000, 25, 40)');
  expect(children[2].getAttribute('transform')).toBe('rotate(-45.000, 30, 40)');
  expect(children[4].getAttribute('fill-opacity')).toBe('0.000');
  expect(children[5].getAttribute('stroke')).toBe('rgb(0, 255, 255)');
  expect(children[5].getAttribute('stroke-opacity')).toBe('0.392');
  view.rerender(<InlineSvgPreview shapes={rows} width={100} height={100} step={3} />);
  expect(view.container.querySelector('svg')!.children).toHaveLength(3);
  const replacement = decodeAllToSvgRows(encodeAllFromShapeJsonList([
    { type: 'CIRCLE', color: { r: 1, g: 2, b: 3, a: 0 }, data: [20, 20, 10] },
  ]), 100, 100);
  view.rerender(<InlineSvgPreview shapes={replacement} width={100} height={100} step={1} />);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(0);
  expect(view.container.querySelector('circle')!.getAttribute('fill-opacity')).toBe('0.000');
});
