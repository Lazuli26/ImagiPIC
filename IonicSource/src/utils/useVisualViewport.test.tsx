import React, { useRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useVisualViewport } from './useVisualViewport';

const Fixture = () => {
  const ref = useRef<HTMLDivElement>(null);
  useVisualViewport(ref);
  return <div ref={ref} data-testid="page"><input aria-label="Draft" /></div>;
};
let viewport: EventTarget & { height: number; offsetTop: number; scale: number };
let frames: FrameRequestCallback[];
const originalViewport = window.visualViewport;
const frame = () => { const pending = frames; frames = []; act(() => pending.forEach(fn => fn(0))); };
beforeEach(() => {
  viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  frames = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => { frames.push(fn); return frames.length; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  cleanup(); jest.restoreAllMocks();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport });
});

test('tracks keyboard height and Safari panning, then drops a stale offset after blur', () => {
  const view = render(<Fixture />);
  const page = view.getByTestId('page');
  expect(page.style.getPropertyValue('--room-viewport-height')).toBe('800px');
  act(() => (view.getByLabelText('Draft') as HTMLInputElement).focus());
  viewport.height = 340; viewport.offsetTop = 40;
  act(() => { viewport.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll')); });
  frame();
  expect(page.style.getPropertyValue('--room-viewport-height')).toBe('340px');
  expect(page.style.getPropertyValue('--room-viewport-top')).toBe('40px');
  act(() => (view.getByLabelText('Draft') as HTMLInputElement).blur());
  viewport.height = 800;
  act(() => { viewport.dispatchEvent(new Event('resize')); });
  frame();
  expect(page.style.getPropertyValue('--room-viewport-top')).toBe('0px');
  view.unmount();
  expect(page.style.getPropertyValue('--room-viewport-height')).toBe('');
});

test('keeps pinch zoom native and falls back to innerHeight without VisualViewport', () => {
  const view = render(<Fixture />);
  viewport.scale = 2; viewport.height = 200;
  act(() => { viewport.dispatchEvent(new Event('resize')); });
  frame();
  expect(view.getByTestId('page').style.getPropertyValue('--room-viewport-height')).toBe('800px');
  view.unmount();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  const fallback = render(<Fixture />);
  fireEvent(window, new Event('resize')); frame();
  expect(fallback.getByTestId('page').style.getPropertyValue('--room-viewport-height')).toBe(`${window.innerHeight}px`);
});
