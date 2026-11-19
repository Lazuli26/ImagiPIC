import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import DeckBuilderModal from './DeckBuilderModal';
import { saveDeckImage } from '../game/deckOperations';
import { normalizeUploadedImage } from '../utils/imageUploadUtils';
import { searchCommonsImages, downloadCommonsImage } from '../utils/commonsImages';

jest.mock('./GeometrizePlayer.tsx/GeoPlayer', () => ({ GeoPlayer: ({ playerUiRef }: any) => { playerUiRef.current = mockPlayer; return null; } }));
jest.mock('../assets/libraries/Geometrize/GeometrizeController', () => ({ GeometrizeController: class { async initialize() { return { width: 100, height: 100 }; } async step() { return []; } dispose() {} } }));
jest.mock('../game/deckOperations', () => ({ saveDeckImage: jest.fn() }));
jest.mock('../firebase/firestore', () => ({ typedDoc: () => ({}), getDocSnap: async () => ({ exists: () => false }) }));
jest.mock('../utils/imageUploadUtils', () => ({ normalizeUploadedImage: jest.fn(), describeNormalization: () => 'ready', resetFileInput: () => {}, getAcceptAttrForMobile: () => 'image/*' }));
jest.mock('../utils/commonsImages', () => ({ searchCommonsImages: jest.fn(), downloadCommonsImage: jest.fn() }));
jest.mock('./GoogleImageSearch', () => ({ autoFocus }: any) => <input aria-label="Búsqueda de Google" autoFocus={autoFocus} />);
jest.mock('@ionic/react', () => {
  const React = require('react');
  const part = ({ children }: any) => React.createElement('div', null, children);
  return { IonFooter: part, IonPopover: ({ isOpen, children }: any) => isOpen ? <div>{children}</div> : null, IonContent: part, IonHeader: part, IonToolbar: part, IonTitle: part, IonButtons: part, IonItem: part, IonLabel: part, IonInput: () => <input aria-label="Nombre de la carta" />, IonRange: part, IonProgressBar: part, IonCard: part, IonCardContent: part, IonNote: part, IonBadge: part, IonIcon: () => null,
    IonButton: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    IonModal: ({ isOpen, children }: any) => isOpen ? <div>{children}</div> : null,
    IonAlert: ({ isOpen, message }: any) => isOpen ? <div role="alert">{message}</div> : null, IonToast: () => null };
});
const mockCompact = Array.from({ length: 250 }, (_x, index) => [6, 255, 4, index, 0, 10, 10]);
const mockPlayer = {
  options: () => ({}), set_cap: () => {}, background_loading: () => {}, play_pause: () => {},
  set_image: async () => true, get_JSON_shapes: async () => [],
  ControllerInstance: { current: { getShapesCompact: async () => mockCompact, currentBitMap: { width: 320, height: 240 } } },
};
const file = new File(['sample'], 'captura.png', { type: 'image/png' });
const props = { ownerUid: 'ana', isOpen: true, onDismiss: jest.fn(), onSaved: jest.fn() };
const paste = (target: EventTarget = document) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { items: [{ kind: 'file', type: file.type, getAsFile: () => file }], files: [file] } });
  target.dispatchEvent(event);
  return event;
};
beforeEach(() => { jest.clearAllMocks(); (normalizeUploadedImage as jest.Mock).mockResolvedValue({ dataUrl: 'data:image/png;base64,c2FtcGxl', width: 320, height: 240 }); });
afterEach(async () => { await act(async () => { cleanup(); }); });
test('normalizes a pasted screenshot through the same pipeline as an uploaded file', async () => {
  const view = render(<DeckBuilderModal {...props} />);
  await act(async () => { expect(paste().defaultPrevented).toBe(true); });
  expect(normalizeUploadedImage).toHaveBeenCalledWith(file, 1048576, .92);
  expect(view.getByText('Imagen preparada · 320 × 240 px')).toBeTruthy();
  expect(view.getByText('Continuar →')).toBeTruthy();
});
test('does not intercept pasting inside an editable field', async () => {
  render(<DeckBuilderModal {...props} />);
  const field = document.createElement('input'); document.body.appendChild(field);
  await act(async () => { expect(paste(field).defaultPrevented).toBe(false); });
  expect(normalizeUploadedImage).not.toHaveBeenCalled(); field.remove();
});
test('removes the paste handler while the editor is closed', async () => {
  render(<DeckBuilderModal {...props} isOpen={false} />);
  await act(async () => { expect(paste().defaultPrevented).toBe(false); });
  expect(normalizeUploadedImage).not.toHaveBeenCalled();
});
test('the paste button explains denied clipboard access', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: jest.fn().mockRejectedValue({ name: 'NotAllowedError' }) } });
  const view = render(<DeckBuilderModal {...props} />);
  await act(async () => { fireEvent.click(view.getByText('Pegar imagen')); });
  expect(view.getByRole('status').textContent).toContain('Permite el acceso');
});
test('the paste button reads a clipboard image and opens the same preview', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => [{ types: ['text/html', 'image/png'], getType: async () => new Blob(['sample'], { type: 'image/png' }) }] } });
  const view = render(<DeckBuilderModal {...props} />);
  await act(async () => { fireEvent.click(view.getByText('Pegar imagen')); });
  expect((normalizeUploadedImage as jest.Mock).mock.calls[0][0].type).toBe('image/png');
  expect(view.getByText('Imagen preparada · 320 × 240 px')).toBeTruthy();
});
test('uses a Commons search result through image normalization and preserves its credit', async () => {
  const image = {
    fileTitle: 'File:Gato feliz.jpg', title: 'Gato feliz',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Gato_feliz.jpg',
    thumbnailUrl: 'https://thumb.wikimedia.org/gato.jpg',
    artist: 'Ana', license: 'CC BY 4.0',
  };
  (searchCommonsImages as jest.Mock).mockResolvedValue([image]);
  (downloadCommonsImage as jest.Mock).mockResolvedValue(file);
  const view = render(<DeckBuilderModal {...props} />);
  expect(view.getByLabelText('Búsqueda de Google')).toBeTruthy();
  fireEvent.click(view.getByText('Wikimedia Commons'));
  await act(async () => {
    fireEvent.change(view.getByLabelText('Qué imagen buscas'), { target: { value: 'gato' } });
    fireEvent.click(view.getByText('Buscar'));
  });
  await act(async () => { fireEvent.click(view.getByLabelText('Usar Gato feliz')); });
  expect(searchCommonsImages).toHaveBeenCalledWith('gato', expect.anything());
  expect(normalizeUploadedImage).toHaveBeenCalledWith(file, 1048576, .92);
  expect(view.container.querySelector('.builder-source-credit')!.textContent).toContain('Gato feliz · Ana · CC BY 4.0');
});

const prepareToSave = async (view: ReturnType<typeof render>) => {
  await act(async () => { paste(); });
  await act(async () => { fireEvent.click(view.getByText('Continuar →')); });
  await act(async () => { fireEvent.click(view.getByText('Crear formas')); });
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect((view.getByText('Guardar carta') as HTMLButtonElement).disabled).toBe(false);
};

test('waits for a confirmed save, then closes the editor and reports the saved image exactly once', async () => {
  jest.useFakeTimers();
  const fetchBefore = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({});
  const imageSpy = jest.spyOn(window as any, 'Image').mockImplementation(() => {
    const image: any = {};
    Object.defineProperty(image, 'src', { set: () => { image.onerror?.(); } });
    return image;
  });
  let resolveSave: (doc: any) => void = () => {};
  (saveDeckImage as jest.Mock).mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
  const view = render(<DeckBuilderModal {...props} />);
  try {
    await prepareToSave(view);
    await act(async () => { fireEvent.click(view.getByText('Guardar carta')); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
    const saved = { id: 'saved-image' };
    await act(async () => { resolveSave(saved); });
    expect(props.onSaved).toHaveBeenCalledTimes(1);
    expect(props.onSaved).toHaveBeenCalledWith(saved);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  } finally {
    cleanup(); imageSpy.mockRestore(); global.fetch = fetchBefore; jest.useRealTimers();
  }
});
test('keeps the editor open and shows the error if saving fails', async () => {
  jest.useFakeTimers();
  const fetchBefore = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({});
  const imageSpy = jest.spyOn(window as any, 'Image').mockImplementation(() => {
    const image: any = {};
    Object.defineProperty(image, 'src', { set: () => { image.onerror?.(); } });
    return image;
  });
  (saveDeckImage as jest.Mock).mockRejectedValue(new Error('Sin conexión'));
  const view = render(<DeckBuilderModal {...props} />);
  try {
    await prepareToSave(view);
    await act(async () => { fireEvent.click(view.getByText('Guardar carta')); });
    expect(view.getByRole('alert').textContent).toContain('Sin conexión');
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  } finally {
    cleanup(); imageSpy.mockRestore(); global.fetch = fetchBefore; jest.useRealTimers();
  }
});

test('opens with search focused and leaves attachments as a secondary action', () => {
  const view = render(<DeckBuilderModal {...props} />);
  const search = view.getByLabelText('Búsqueda de Google');
  expect(document.activeElement).toBe(search);
  expect(search.compareDocumentPosition(view.getByText('Adjuntar archivo')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(view.queryByText(/Paso .* de 4/)).toBeNull();
});

test('changing generation settings requires new shapes before the image can be saved', async () => {
  jest.useFakeTimers();
  const view = render(<DeckBuilderModal {...props} />);
  try {
    await prepareToSave(view);
    fireEvent.change(view.getByLabelText(/Cantidad de formas/), { target: { value: '300' } });
    expect(view.queryByText('Guardar carta')).toBeNull();
    expect(view.getByText('Crear formas')).toBeTruthy();
    expect(saveDeckImage).not.toHaveBeenCalled();
  } finally { cleanup(); jest.useRealTimers(); }
});

test('a failed image initialization allows retrying without leaving the editor busy', async () => {
  const initialize = jest.spyOn(mockPlayer, 'set_image').mockRejectedValueOnce(new Error('decode failed'));
  const view = render(<DeckBuilderModal {...props} />);
  try {
    await act(async () => { paste(); });
    await act(async () => { fireEvent.click(view.getByText('Continuar →')); });
    await act(async () => { fireEvent.click(view.getByText('Crear formas')); });
    expect(view.getByRole('alert').textContent).toContain('No se pudo crear');
    expect((view.getByText('Crear formas') as HTMLButtonElement).disabled).toBe(false);
    expect(view.queryByText('Guardar carta')).toBeNull();
  } finally { initialize.mockRestore(); }
});
