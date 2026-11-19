import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import ShapeStylePreview from './ShapeStylePreview';
import { GeometrizeController } from '../assets/libraries/Geometrize/GeometrizeController';

jest.mock('../assets/libraries/Geometrize/GeometrizeController', () => ({ GeometrizeController: jest.fn() }));
const compact = [[6, 0xff0000ff, 4, 0, 0, 100, 100]];
const controller = () => ({ initialize: jest.fn().mockResolvedValue({ width: 100, height: 100 }), step: jest.fn().mockResolvedValue([]), getShapesCompact: jest.fn().mockResolvedValue(compact), dispose: jest.fn() });
const props = { imageSrc: 'image-one', shapeTypes: [2, 4], alpha: 128, candidateShapesPerStep: 50, shapeMutationsPerStep: 50, maxPixels: 262144 };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(async () => { await act(async () => { cleanup(); }); jest.clearAllTimers(); jest.useRealTimers(); });

test('previews the selected mixture on the image with a bounded worker and allows comparison', async () => {
  const engine = controller();
  (GeometrizeController as jest.Mock).mockReturnValue(engine);
  const view = render(<ShapeStylePreview {...props} />);
  await act(async () => { jest.advanceTimersByTime(250); });
  expect(engine.initialize).toHaveBeenCalledWith('image-one', expect.objectContaining({ shapeTypes: [2, 4], maxPixels: 16384, alpha: 128 }));
  expect(engine.step).toHaveBeenCalledWith(24);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(1);
  expect(view.getByRole('status').textContent).toBe('Vista previa de la mezcla');
  fireEvent.click(view.getByText('Ver original'));
  expect(view.getByAltText('Imagen original')).toBeTruthy();
  fireEvent.click(view.getByText('Ver mezcla'));
  expect(view.container.querySelector('svg')).toBeTruthy();
  expect(engine.dispose).toHaveBeenCalled();
});

test('a stale recipe cannot overwrite a newer image or update an unmounted preview', async () => {
  const first = controller();
  let finish: (value: any) => void = () => {};
  first.initialize.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const second = controller();
  (GeometrizeController as jest.Mock).mockReturnValueOnce(first).mockReturnValueOnce(second);
  const view = render(<ShapeStylePreview {...props} />);
  await act(async () => { jest.advanceTimersByTime(250); });
  view.rerender(<ShapeStylePreview {...props} imageSrc="image-two" shapeTypes={[5]} />);
  await act(async () => { jest.advanceTimersByTime(250); });
  expect(second.initialize).toHaveBeenCalledWith('image-two', expect.objectContaining({ shapeTypes: [5] }));
  await act(async () => { finish({ width: 200, height: 200 }); });
  expect(first.step).not.toHaveBeenCalled();
  expect(first.dispose).toHaveBeenCalled();
  expect(view.container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 100 100');
});
