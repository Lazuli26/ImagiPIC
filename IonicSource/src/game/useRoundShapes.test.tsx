import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { getDocFromServer } from 'firebase/firestore';
import { useRoundShapes } from './useRoundShapes';
import type { RoundDoc } from '../types/database';

jest.mock('../firebase/firebaseApp', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: (_db: any, path: string) => path, getDocFromServer: jest.fn() }));
const read = getDocFromServer as jest.Mock;
const shapes = (x: number) => [6, 255, 4, x, 0, 10, 10];
const round = { roundIndex: 0, imageRef: 'user_decks/a/images/one', width: 100, height: 100, shapesCompactCopy: shapes(1) } as RoundDoc;
const Preview = ({ round }: { round: RoundDoc }) => {
  const { rows } = useRoundShapes(round);
  return <svg dangerouslySetInnerHTML={{ __html: rows.join('') }} />;
};
afterEach(() => { cleanup(); jest.clearAllMocks(); });

test('renders the round copy immediately without fetching a private deck', () => {
  const view = render(<Preview round={round} />);
  expect(view.container.querySelector('rect')?.getAttribute('x')).toBe('1');
  expect(read).not.toHaveBeenCalled();
});
test('an updated image with the same number of shapes is decoded again', () => {
  const view = render(<Preview round={round} />);
  view.rerender(<Preview round={{ ...round, shapesCompactCopy: shapes(9) }} />);
  expect(view.container.querySelector('rect')?.getAttribute('x')).toBe('9');
});
test('a late deck response cannot overwrite the next turn', async () => {
  let resolve: (value: any) => void = () => {};
  read.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<Preview round={{ ...round, shapesCompactCopy: undefined }} />);
  view.rerender(<Preview round={{ ...round, roundIndex: 1, imageRef: 'user_decks/a/images/two', shapesCompactCopy: shapes(8) }} />);
  await act(async () => { resolve({ exists: () => true, data: () => ({ width: 100, height: 100, shapesCompact: shapes(2) }) }); });
  expect(view.container.querySelector('rect')?.getAttribute('x')).toBe('8');
});
test('a round update wins over an in-flight fallback for the same image', async () => {
  let resolve: (value: any) => void = () => {};
  read.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<Preview round={{ ...round, shapesCompactCopy: [] }} />);
  view.rerender(<Preview round={round} />);
  await act(async () => { resolve({ exists: () => true, data: () => ({ shapesCompact: shapes(2) }) }); });
  expect(view.container.querySelector('rect')?.getAttribute('x')).toBe('1');
});
