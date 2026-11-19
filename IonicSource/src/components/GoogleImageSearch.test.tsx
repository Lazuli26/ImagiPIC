import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import GoogleImageSearch from './GoogleImageSearch';
import { downloadGoogleThumbnail, loadGoogleProgrammableSearch, mountGoogleImageResults } from '../utils/googleProgrammableSearch';

jest.mock('../utils/googleProgrammableSearch', () => ({
  downloadGoogleThumbnail: jest.fn(),
  loadGoogleProgrammableSearch: jest.fn(),
  mountGoogleImageResults: jest.fn(),
}));

const result = {
  title: 'Gato meme',
  thumbnailUrl: 'https://i.imgflip.com/gato-small.jpg',
  pageUrl: 'https://imgflip.com/i/gato',
};
const file = new File(['image'], 'gato.jpg', { type: 'image/jpeg' });
let showResult: (value: typeof result) => void;

beforeEach(() => {
  jest.clearAllMocks();
  (loadGoogleProgrammableSearch as jest.Mock).mockResolvedValue(undefined);
  (mountGoogleImageResults as jest.Mock).mockImplementation((_container, onSelect) => {
    showResult = onSelect;
    return { search: jest.fn(), dispose: jest.fn() };
  });
});
afterEach(cleanup);

test('opens a large preview and imports only after confirmation', async () => {
  (downloadGoogleThumbnail as jest.Mock).mockResolvedValue(file);
  const onSelect = jest.fn().mockResolvedValue(undefined);
  const view = render(<GoogleImageSearch engineId="engine-123" onSelect={onSelect} />);
  await act(async () => { await Promise.resolve(); });
  act(() => showResult(result));
  expect(view.getByRole('dialog').getAttribute('aria-label')).toContain('Gato meme');
  expect((view.getByRole('dialog').querySelector('img') as HTMLImageElement).src).toBe(result.thumbnailUrl);
  expect(onSelect).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(view.getByText('Usar esta imagen')); });
  expect(downloadGoogleThumbnail).toHaveBeenCalledWith(result, expect.anything());
  expect(onSelect).toHaveBeenCalledWith(file, expect.objectContaining({ pageUrl: result.pageUrl }));
});

test('keeps the preview open and explains a failed thumbnail download', async () => {
  (downloadGoogleThumbnail as jest.Mock).mockRejectedValue(new Error('Google no entregó la miniatura'));
  const view = render(<GoogleImageSearch engineId="engine-123" onSelect={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });
  act(() => showResult(result));
  await act(async () => { fireEvent.click(view.getByText('Usar esta imagen')); });
  expect(view.getByRole('dialog')).toBeTruthy();
  expect(view.getByRole('alert').textContent).toContain('no entregó la miniatura');
  fireEvent.click(view.getByLabelText('Cerrar vista previa'));
  expect(view.queryByRole('dialog')).toBeNull();
});
