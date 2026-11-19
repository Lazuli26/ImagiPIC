import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import GuessChatPanel from './GuessChatPanel';
import { writeBatch, runTransaction } from 'firebase/firestore';
import type { RoomPlayer, RoundDoc } from '../../types/database';

let mockAnswers: any[] = [{ id: 'answer', uid: 'b', displayName: 'Beto', textRaw: 'Un faro', textNormalized: 'un faro', verdict: 'CORRECT', submittedAt: { toMillis: () => 1000 } }];
jest.mock('../../game/useGuesses', () => ({ useGuesses: () => ({ guesses: mockAnswers }) }));
jest.mock('../../firebase/firebaseApp', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: any, path: string) => path ? path : { id: 'new-answer' },
  collection: (_db: any, path: string) => path,
  writeBatch: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'server-time',
}));
jest.mock('@ionic/react', () => {
  const React = require('react');
  const part = ({ children }: any) => React.createElement('div', null, children);
  return { IonContent: part, IonText: part, IonAvatar: part, IonBadge: part, IonButton: ({ children, onClick, disabled, ...props }: any) => <button onClick={onClick} disabled={disabled} aria-label={props['aria-label']} aria-pressed={props['aria-pressed']}>{children}</button>, IonIcon: part, IonInput: part, IonCard: part, IonCardContent: part, IonToast: () => null };
});
const players = [{ uid: 'a', displayName: 'Ana' }, { uid: 'b', displayName: 'Beto' }] as RoomPlayer[];
const round = { id: 'round-0', roundIndex: 0, judgeUid: 'judge', state: 'IN_PROGRESS' } as RoundDoc;
const props = { code: 'TEST12', round, currentUid: 'a', currentUserName: 'Ana', isJudge: false, players };
let batch: { update: jest.Mock; commit: jest.Mock };
beforeEach(() => {
  jest.useFakeTimers();
  mockAnswers = [{ id: 'answer', uid: 'b', displayName: 'Beto', textRaw: 'Un faro', textNormalized: 'un faro', verdict: 'CORRECT', submittedAt: { toMillis: () => 1000 } }];
  batch = { update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  (writeBatch as jest.Mock).mockReturnValue(batch);
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); jest.clearAllMocks(); });

test('announces another player solved the image without revealing the answer', () => {
  const view = render(<GuessChatPanel {...props} />);
  expect(view.getByText('Beto acertó 🎉')).toBeTruthy();
  expect(view.queryByText('Un faro')).toBeNull();
});
test('reveals the answers once guessing closes', () => {
  const view = render(<GuessChatPanel {...props} round={{ ...round, state: 'ADJUDICATION' }} />);
  expect(view.getByText('Un faro')).toBeTruthy();
});
test('a player who solved it sees their answer and waits for results', () => {
  const view = render(<GuessChatPanel {...props} currentUid="b" currentUserName="Beto" />);
  expect(view.getByText('Un faro')).toBeTruthy();
  expect(view.getByRole('status').textContent).toContain('¡Acertaste!');
});

test.each(['CORRECT', 'WRONG'])('automatically applies an existing %s decision to later identical answers', async verdict => {
  mockAnswers[0].verdict = verdict;
  const view = render(<GuessChatPanel {...props} isJudge />);
  expect(batch.update).not.toHaveBeenCalled();
  mockAnswers = [...mockAnswers, { ...mockAnswers[0], id: 'late', uid: 'a', verdict: null }];
  await act(async () => { view.rerender(<GuessChatPanel {...props} isJudge players={[...players]} />); });
  expect(batch.update).toHaveBeenCalledTimes(1);
  expect(batch.update).toHaveBeenCalledWith('rooms/TEST12/rounds/round-0/guesses/late', {
    verdict, stars: verdict === 'CORRECT' ? 3 : null, verdictAt: 'server-time', verdictBy: 'a',
  });
});
test('pauses while typing, resumes after inactivity, and explicitly discards the draft', () => {
  const onWritingChange = jest.fn();
  const view = render(<GuessChatPanel {...props} onWritingChange={onWritingChange} />);
  const input = view.getByLabelText('Tu respuesta') as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'un barco' } });
  expect(onWritingChange).toHaveBeenLastCalledWith(true);
  expect(view.getByRole('status').textContent).toContain('Imagen pausada');
  act(() => { jest.advanceTimersByTime(1500); });
  expect(onWritingChange).toHaveBeenLastCalledWith(false);
  expect(input.value).toBe('un barco');
  fireEvent.change(input, { target: { value: 'otro barco' } });
  fireEvent.click(view.getByText('Descartar mensaje'));
  expect(input.value).toBe('');
  expect(onWritingChange).toHaveBeenLastCalledWith(false);
});
test('sending a draft resumes playback only after a successful submission', async () => {
  (runTransaction as jest.Mock).mockImplementation(async (_db, action) => action({
    get: async () => ({ exists: () => false }), set: jest.fn(),
  }));
  const onWritingChange = jest.fn();
  const view = render(<GuessChatPanel {...props} onWritingChange={onWritingChange} />);
  const input = view.getByLabelText('Tu respuesta') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'un barco' } });
  await act(async () => { fireEvent.click(view.getByText('Enviar')); });
  expect(runTransaction).toHaveBeenCalledTimes(1);
  expect(input.value).toBe('');
  expect(onWritingChange).toHaveBeenLastCalledWith(false);
});
test('announces completion only after every guesser has a confirmed correct answer', () => {
  const onAllGuessedChange = jest.fn();
  const view = render(<GuessChatPanel {...props} isJudge onAllGuessedChange={onAllGuessedChange} />);
  expect(onAllGuessedChange).toHaveBeenLastCalledWith(false);
  mockAnswers = [...mockAnswers, { ...mockAnswers[0], id: 'other', uid: 'a' }];
  view.rerender(<GuessChatPanel {...props} isJudge players={[...players]} onAllGuessedChange={onAllGuessedChange} />);
  expect(onAllGuessedChange).toHaveBeenLastCalledWith(true);
});

test('timer renders preserve the native keyboard buffer and caret during composition', () => {
  const view = render(<GuessChatPanel {...props} />);
  const input = view.getByLabelText('Tu respuesta') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'un avion' } });
  fireEvent.compositionStart(input);
  // Mobile keyboards can edit the native buffer before publishing a change.
  input.value = 'un avión';
  input.setSelectionRange(5, 5);
  act(() => { jest.advanceTimersByTime(1000); });
  expect(input.value).toBe('un avión');
  expect(input.selectionStart).toBe(5);
  expect(view.getByLabelText('Tu respuesta')).toBe(input);
});

test('composition Enter does not send; the final native text is saved in its original order', async () => {
  const set = jest.fn();
  (runTransaction as jest.Mock).mockImplementation(async (_db, action) => action({
    get: async () => ({ exists: () => false }), set,
  }));
  const view = render(<GuessChatPanel {...props} />);
  const input = view.getByLabelText('Tu respuesta') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'un avion' } });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(runTransaction).not.toHaveBeenCalled();
  input.value = 'un avión 🛩️';
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
  expect(runTransaction).not.toHaveBeenCalled();
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 }); });
  expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    textRaw: 'un avión 🛩️', textNormalized: 'un avión 🛩️',
  }));
  expect(input.value).toBe('');
});

test('a failed submission preserves the native draft for retry', async () => {
  (runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  const view = render(<GuessChatPanel {...props} />);
  const input = view.getByLabelText('Tu respuesta') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Una casa' } });
  await act(async () => { fireEvent.click(view.getByText('Enviar')); });
  expect(input.value).toBe('Una casa');
  expect(input.disabled).toBe(false);
});


test.each([1, 2, 3])('any star level counts as correct and prevents further submissions (%s)', stars => {
  mockAnswers[0].stars = stars;
  const view = render(<GuessChatPanel {...props} currentUid="b" />);
  expect(view.getByRole('status').textContent).toContain('¡Acertaste!');
  expect(view.queryByLabelText('Tu respuesta')).toBeNull();
});

test('the judge can revise a correct answer without toggling it back to pending', async () => {
  mockAnswers[0].stars = 1;
  const view = render(<GuessChatPanel {...props} isJudge />);
  await act(async () => { fireEvent.click(view.getByLabelText('Dar 3 estrellas a Un faro')); });
  expect(batch.update).toHaveBeenLastCalledWith('rooms/TEST12/rounds/round-0/guesses/answer', {
    verdict: 'CORRECT', stars: 3, verdictAt: 'server-time', verdictBy: 'a',
  });
  mockAnswers = [{ ...mockAnswers[0], stars: 3 }];
  view.rerender(<GuessChatPanel {...props} isJudge round={{ ...round, state: 'ADJUDICATION' }} />);
  await act(async () => { fireEvent.click(view.getByLabelText('Dar 3 estrellas a Un faro')); });
  expect(batch.update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ verdict: 'CORRECT', stars: 3 }));
  await act(async () => { fireEvent.click(view.getByLabelText('Dar 2 estrellas a Un faro')); });
  expect(batch.update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ verdict: 'CORRECT', stars: 2 }));
});

test('later identical answers inherit the chosen star level', async () => {
  mockAnswers[0].stars = 1;
  const view = render(<GuessChatPanel {...props} isJudge />);
  mockAnswers = [...mockAnswers, { ...mockAnswers[0], id: 'late', uid: 'a', verdict: null, stars: null }];
  await act(async () => { view.rerender(<GuessChatPanel {...props} isJudge players={[...players]} />); });
  expect(batch.update).toHaveBeenCalledWith('rooms/TEST12/rounds/round-0/guesses/late', {
    verdict: 'CORRECT', stars: 1, verdictAt: 'server-time', verdictBy: 'a',
  });
});

test('star editing freezes when review closes', () => {
  const view = render(<GuessChatPanel {...props} isJudge round={{ ...round, state: 'ADJUDICATION_CLOSED' }} />);
  fireEvent.click(view.getByLabelText('Dar 2 estrellas a Un faro'));
  expect(batch.update).not.toHaveBeenCalled();
});
