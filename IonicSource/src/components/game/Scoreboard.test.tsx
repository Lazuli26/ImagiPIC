import React from 'react';
import { act, fireEvent, render, cleanup } from '@testing-library/react';
import Scoreboard from './Scoreboard';
import { RoomDoc, RoundDoc, RoomPlayer } from '../../types/database';

jest.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  IonProgressBar: () => <div />,
}));
const players = [{ uid: 'a', displayName: 'Ana' }, { uid: 'b', displayName: 'Beto' }] as RoomPlayer[];
const room = { code: 'TEST12', hostUid: 'a', state: 'PLAYING', maxPlayers: 12, roundTimerSecs: 60, graceTimerSecs: 20, createdAt: {} as any, players, turnOrder: ['a', 'b'], roundIndex: 1, totalTurns: 2, cumulativeScores: { a: 100 }, scoreboardTimerSecs: 5 } as RoomDoc;
const round = { id: 'round-1', roundIndex: 1, judgeUid: 'b', shapeCount: 0 } as RoundDoc;
const props = { room, round, players, guesses: [], perPlayerScores: { a: 100 }, rankOrder: ['a'], onNextTurn: jest.fn().mockResolvedValue(undefined), isHost: true };
let now = 0;
beforeEach(() => { now = Date.now(); jest.spyOn(Date, 'now').mockImplementation(() => now); jest.useFakeTimers(); props.onNextTurn.mockClear(); });
const advanceTime = (ms: number) => { now += ms; jest.advanceTimersByTime(ms); };
afterEach(async () => { await act(async () => { cleanup(); }); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test('the last turn offers final results and lists everyone', () => {
  const view = render(<Scoreboard {...props} />);
  expect(view.getByText('Ver resultados finales')).toBeTruthy();
  expect(view.getAllByText('Beto').length).toBeGreaterThan(0);
});
test('the completed image keeps the color modifier chosen for the turn', () => {
  const view = render(<Scoreboard {...props} round={{ ...round, shapesCompactCopy: [6, 255, 4, 0, 0, 10, 10], imageModifier: { type: 'black-and-white' } }} />);
  expect(view.container.querySelector('svg')!.style.filter).toBe('grayscale(1)');
  view.rerender(<Scoreboard {...props} round={{ ...round, shapesCompactCopy: [6, 255, 4, 0, 0, 10, 10], imageModifier: { type: 'hue-shift', degrees: 60 } }} />);
  expect(view.container.querySelector('svg')!.style.filter).toBe('hue-rotate(60deg)');
});
test('only the host advances, once, when the countdown expires', async () => {
  const view = render(<Scoreboard {...props} isHost={false} />);
  act(() => { advanceTime(6000); });
  expect(props.onNextTurn).not.toHaveBeenCalled();
  view.unmount();
  render(<Scoreboard {...props} />);
  await act(async () => { advanceTime(10000); });
  expect(props.onNextTurn).toHaveBeenCalledTimes(1);
});
test('manual progression waits for the host without a hidden timer', async () => {
  const view = render(<Scoreboard {...props} room={{ ...room, scoreboardTimerSecs: 0 }} />);
  act(() => { advanceTime(60000); });
  expect(props.onNextTurn).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(view.getByText('Ver resultados finales')); });
  expect(props.onNextTurn).toHaveBeenCalledTimes(1);
});
test('a failed advance shows an error and allows a retry', async () => {
  props.onNextTurn.mockRejectedValueOnce(new Error('offline'));
  const view = render(<Scoreboard {...props} />);
  await act(async () => { advanceTime(5000); });
  expect(view.getByRole('alert').textContent).toContain('Vuelve a intentarlo');
  await act(async () => { fireEvent.click(view.getByText('Ver resultados finales')); });
  expect(props.onNextTurn).toHaveBeenCalledTimes(2);
});

test('judge points do not inflate the correct count or replace the earliest actual answer', () => {
  const scoredRound = { ...round, judgeUid: 'b' };
  const answers = [{ uid: 'a', verdict: 'CORRECT', submittedAt: { toMillis: () => 1000 } }] as any;
  const view = render(<Scoreboard {...props} round={scoredRound} guesses={answers}
    rankOrder={['b', 'a']} perPlayerScores={{ b: 100, a: 95 }} />);
  expect(view.getByText(/1 de 1 jugadores acertaron/)).toBeTruthy();
  expect(view.container.querySelector('.game-notice')!.textContent).toContain('Primer acierto: Ana');
  expect(view.getByText(/Imagen del juez:/).textContent).toContain('+100 pts');
  expect(view.container.querySelector('.turn-points small')!.textContent).toContain('Presentó');
});


test('on a phone the standings come first and the completed image opens only on request', () => {
  const width = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  try {
    const view = render(<Scoreboard {...props} round={{ ...round, shapesCompactCopy: [6, 255, 4, 0, 0, 10, 10] }} />);
    const scores = view.container.querySelector('.scores-card')!;
    const reveal = view.container.querySelector('.reveal-card')!;
    expect(scores.compareDocumentPosition(reveal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.queryByRole('img', { name: 'Imagen completa del turno' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: /Ver imagen del turno/ }));
    expect(view.getByRole('img', { name: 'Imagen completa del turno' })).toBeTruthy();
  } finally { Object.defineProperty(window, 'innerWidth', { configurable: true, value: width }); }
});
