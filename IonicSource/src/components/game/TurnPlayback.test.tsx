import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { getDocFromServer, updateDoc } from 'firebase/firestore';
import TurnPlayback from './TurnPlayback';
import { watchDocument } from '../../game/watchDocument';
import type { RoomPlayer, RoundDoc } from '../../types/database';
import { seededShapeOrder } from '../../game/imageModifiers';

jest.mock('../../firebase/firebaseApp', () => ({ db: {} }));
jest.mock('../../game/watchDocument', () => ({ watchDocument: jest.fn() }));
let mockChatProps: any;
jest.mock('./GuessChatPanel', () => (props: any) => { mockChatProps = props; return <input data-testid="chat-draft" />; });
jest.mock('firebase/firestore', () => ({
  doc: (_db: any, path: string) => path,
  updateDoc: jest.fn().mockResolvedValue(undefined),
  getDocFromServer: jest.fn(),
  arrayUnion: (uid: string) => [uid],
  serverTimestamp: () => 'server-time',
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}));
jest.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  IonIcon: () => null, IonText: ({ children }: any) => <span>{children}</span>, IonProgressBar: () => <div />,
}));
let mockReady: (snapshot: any) => void;
let frames: FrameRequestCallback[];
const shapes = Array.from({ length: 10 }, (_value, x) => [6, 255, 4, x, 0, 10, 10]).reduce((all, row) => all.concat(row), []);
const round = {
  id: 'round-0', roundIndex: 0, judgeUid: 'a', imageRef: 'user_decks/a/images/one',
  width: 100, height: 100, shapeCount: 10, shapesCompactCopy: shapes,
  state: 'PROCESSING', roundTimerSecs: 60, graceTimerSecs: 10,
  playback: { playing: false, rate: 2, anchorStep: 5, anchorAt: { toMillis: () => Date.now() } },
} as RoundDoc;
const props = { code: 'TEST12', round, currentUid: 'a', currentUserName: 'Ana', isJudge: true, judgeName: 'Ana', players: [{ uid: 'a' }, { uid: 'b' }] as RoomPlayer[] };
const frame = () => { const pending = frames; frames = []; act(() => { pending.forEach(callback => callback(Date.now())); }); };
beforeEach(() => {
  frames = [];
  (updateDoc as jest.Mock).mockResolvedValue(undefined);
  (watchDocument as jest.Mock).mockImplementation((_ref, next) => { mockReady = next; return () => {}; });
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); jest.clearAllMocks(); });

test('crossing the layout breakpoint keeps the draft input and painted SVG mounted', () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    const view = render(<TurnPlayback {...props} isJudge={false} />);
    const input = view.getByTestId('chat-draft') as HTMLInputElement;
    const svg = view.container.querySelector('svg');
    input.value = 'Un avión';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    fireEvent(window, new Event('resize')); frame();
    expect(view.container.querySelector('.turn-playback')!.getAttribute('style')).toContain('flex-direction: row');
    expect(view.getByTestId('chat-draft')).toBe(input);
    expect(input.value).toBe('Un avión');
    expect(view.container.querySelector('svg')).toBe(svg);
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
  }
});

test('shows the full image only to the judge and starts from the shared initial shapes', async () => {
  const view = render(<TurnPlayback {...props} />);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(10);
  expect((view.getByText('Iniciar turno') as HTMLButtonElement).disabled).toBe(true);
  frame(); frame();
  await act(async () => {});
  expect(updateDoc).toHaveBeenCalledWith('rooms/TEST12/rounds/round-0/_counter/meta', { previewReadyUids: ['a'] });
  expect(updateDoc).not.toHaveBeenCalledWith('rooms/TEST12/rounds/round-0', expect.anything());
  act(() => { mockReady({ data: () => ({ previewReadyUids: ['a', 'b'] }) }); });
  await act(async () => { fireEvent.click(view.getByText('Iniciar turno')); });
  expect(updateDoc).toHaveBeenCalledWith('rooms/TEST12/rounds/round-0', expect.objectContaining({
    state: 'IN_PROGRESS', startedAt: 'server-time', playback: expect.objectContaining({ playing: true, anchorStep: 5 }),
  }));
});

test('the saved color modifier applies to guessers from their first shared preview', () => {
  const view = render(<TurnPlayback {...props} isJudge={false} round={{ ...round, imageModifier: { type: 'black-and-white' } }} />);
  expect(view.container.querySelector('svg')!.style.filter).toBe('grayscale(1)');
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(5);
  expect(view.queryByText('Modificador de imagen')).toBeNull();
  view.rerender(<TurnPlayback {...props} isJudge={false} round={{ ...round, imageModifier: { type: 'hue-shift', degrees: -120 } }} />);
  expect(view.container.querySelector('svg')!.style.filter).toBe('hue-rotate(-120deg)');
});

test('a new turn does not retain the previous image modifier', () => {
  const view = render(<TurnPlayback {...props} round={{ ...round, imageModifier: { type: 'black-and-white' } }} />);
  view.rerender(<TurnPlayback {...props} round={{ ...round, id: 'round-1', roundIndex: 1 }} />);
  expect(view.container.querySelector('svg')!.style.filter).toBe('');
});

test('the confirmed shuffle seed gives clients the same shapes across pause and resume', async () => {
  const selectedRound = { ...round, imageModifier: { type: 'shuffle', seed: 'mis-figuras' } } as RoundDoc;
  const view = render(<TurnPlayback {...props} round={selectedRound} />);
  fireEvent.click(view.getByText('Permitir inicio sin esperar a todos'));
  await act(async () => { fireEvent.click(view.getByText('Iniciar turno')); });
  const patch = (updateDoc as jest.Mock).mock.calls.find(([path]) => path.endsWith('/round-0'))![1];
  expect(patch.imageModifier).toBeUndefined();
  const started = { ...selectedRound, ...patch } as RoundDoc;
  view.rerender(<TurnPlayback {...props} round={started} />);
  const selected = () => Array.from(view.container.querySelectorAll('svg rect')).map(node => Number(node.getAttribute('x')));
  const expected = seededShapeOrder(10, 'mis-figuras').slice(0, 5).sort((a, b) => a - b);
  expect(selected()).toEqual(expected);
  view.rerender(<TurnPlayback {...props} currentUid="b" isJudge={false} round={started} />);
  expect(selected()).toEqual(expected);
  expect(view.queryByText('Modificador de imagen')).toBeNull();
  const paused = { ...started, playback: { ...started.playback, playing: false, anchorStep: 7 } };
  view.rerender(<TurnPlayback {...props} currentUid="b" isJudge={false} round={paused} />);
  expect(selected()).toEqual(seededShapeOrder(10, 'mis-figuras').slice(0, 7).sort((a, b) => a - b));
  view.rerender(<TurnPlayback {...props} currentUid="b" isJudge={false} round={{ ...paused, playback: { ...paused.playback, playing: true } }} />);
  expect(selected()).toEqual(seededShapeOrder(10, 'mis-figuras').slice(0, 7).sort((a, b) => a - b));
});

test('a rejected start preserves the chosen modifier and complete preview for a retry', async () => {
  (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const view = render(<TurnPlayback {...props} round={{ ...round, imageModifier: { type: 'black-and-white' } }} />);
  fireEvent.click(view.getByText('Permitir inicio sin esperar a todos'));
  await act(async () => { fireEvent.click(view.getByText('Iniciar turno')); });
  expect(view.getByRole('alert').textContent).toContain('No se pudo aplicar');
  expect(view.container.querySelector('svg')!.style.filter).toBe('grayscale(1)');
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(10);
});

test('starting without other players still waits for the local image, including fallback images', async () => {
  let resolve: (value: any) => void = () => {};
  (getDocFromServer as jest.Mock).mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<TurnPlayback {...props} round={{ ...round, shapesCompactCopy: undefined }} />);
  fireEvent.click(view.getByText('Permitir inicio sin esperar a todos'));
  expect((view.getByText('Iniciar turno') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { resolve({ exists: () => true, data: () => ({ width: 100, height: 100, shapesCompact: shapes }) }); });
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(10);
  expect((view.getByText('Iniciar turno') as HTMLButtonElement).disabled).toBe(false);
});
test('guesser renders preview and then the started image without a remount or refresh', async () => {
  const startedMs = Date.now() - 1000;
  const view = render(<TurnPlayback {...props} currentUid="b" isJudge={false} />);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(5);
  view.rerender(<TurnPlayback {...props} currentUid="b" isJudge={false} round={{
    ...round, state: 'IN_PROGRESS', startedAt: { toMillis: () => startedMs } as any,
    playback: { ...round.playback, playing: true, anchorAt: { toMillis: () => startedMs } as any },
  }} />);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(7);
});

test('a delayed processing round always starts with the preview, even with an old playback anchor', async () => {
  const view = render(<TurnPlayback {...props} round={{ ...round,
    startedAt: { toMillis: () => Date.now() - 600000 } as any,
    playback: { ...round.playback, playing: true, anchorAt: { toMillis: () => Date.now() - 600000 } as any },
  }} />);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(10);
  fireEvent.click(view.getByText('Permitir inicio sin esperar a todos'));
  await act(async () => { fireEvent.click(view.getByText('Iniciar turno')); });
  expect(updateDoc).toHaveBeenCalledWith('rooms/TEST12/rounds/round-0', expect.objectContaining({
    playback: expect.objectContaining({ playing: true, anchorStep: 5, anchorAt: 'server-time' }),
  }));
});
test('an unresolved playback timestamp never uses the old setup timer to reveal the image', () => {
  const view = render(<TurnPlayback {...props} round={{ ...round, state: 'IN_PROGRESS',
    startedAt: { toMillis: () => Date.now() - 600000 } as any,
    playback: { ...round.playback, playing: true, anchorAt: null as any },
  }} />);
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(5);
});
test('appends shapes without replacing the existing SVG nodes and freezes painting while writing', () => {
  let now = 1000000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const active = { ...round, state: 'IN_PROGRESS', startedAt: { toMillis: () => 1000000 },
    playback: { ...round.playback, playing: true, anchorAt: { toMillis: () => 1000000 } },
  } as RoundDoc;
  const view = render(<TurnPlayback {...props} round={active} isJudge={false} />);
  const firstShape = view.container.querySelector('svg rect');
  act(() => { now += 1000; jest.advanceTimersByTime(100); });
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(7);
  expect(view.container.querySelector('svg rect')).toBe(firstShape);
  act(() => mockChatProps.onWritingChange(true));
  act(() => { now += 1000; jest.advanceTimersByTime(1000); });
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(7);
  act(() => mockChatProps.onWritingChange(false));
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(9);
  expect(view.container.querySelector('svg rect')).toBe(firstShape);
  view.rerender(<TurnPlayback {...props} isJudge={false} round={{ ...active, shapesCompactCopy: [...shapes] }} />);
  expect(view.container.querySelector('svg rect')).toBe(firstShape);
});
test('offers an optional skip after everyone solves it, without advancing automatically', async () => {
  const view = render(<TurnPlayback {...props} />);
  const controls = view.container.querySelector('.judge-action-bar')!;
  const image = view.container.querySelector('svg')!;
  expect(controls.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  view.rerender(<TurnPlayback {...props} round={{ ...round, state: 'IN_PROGRESS' }} />);
  act(() => mockChatProps.onAllGuessedChange(true));
  expect(view.getByRole('status').textContent).toContain('¡Todos acertaron!');
  expect(updateDoc).not.toHaveBeenCalledWith('rooms/TEST12/rounds/round-0', expect.anything());
  await act(async () => { fireEvent.click(view.getByText('Saltar a los puntos')); });
  expect(updateDoc).toHaveBeenCalledWith('rooms/TEST12/rounds/round-0', { state: 'ADJUDICATION_CLOSED' });
});
