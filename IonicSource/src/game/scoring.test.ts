import { computeScores } from './scoring';
import type { CorrectStars, GuessDoc, RoundDoc } from '../types/database';

const time = (ms: number) => ({ toMillis: () => ms } as any);
const round = { judgeUid: 'judge', startedAt: time(1000), roundTimerSecs: 60 } as RoundDoc;
const answer = (uid: string, elapsed: number, stars: CorrectStars = 3): GuessDoc => ({
  id: `${uid}-${elapsed}`, uid, textRaw: 'Sol', textNormalized: 'sol', displayName: uid,
  submittedAt: time(1000 + elapsed), verdict: 'CORRECT', stars, verdictAt: null, verdictBy: null,
});

test('a late first answer gets its quality points without a full speed bonus', () => {
  const scores = computeScores(round, [answer('a', 60000)], ['judge', 'a', 'b']);
  expect(scores.perPlayerScores).toEqual({ a: 90, judge: 50 });
});
test('quality takes priority over speed and every correct level earns points', () => {
  const scores = computeScores(round, [answer('a', 0, 1), answer('b', 30000, 2), answer('c', 60000, 3)], ['judge', 'a', 'b', 'c']);
  expect(scores.perPlayerScores).toEqual({ a: 40, b: 65, c: 90, judge: 67 });
  expect(scores.rankOrder).toEqual(['c', 'judge', 'b', 'a']);
});
test('counts each player once and chooses the highest scoring answer', () => {
  const scores = computeScores(round, [answer('a', 0, 1), answer('a', 30000, 3), answer('a', 40000, 3)], ['judge', 'a']);
  expect(scores.perPlayerScores).toEqual({ a: 95, judge: 100 });
  expect(scores.meta.bestByUid.a.submittedAt.toMillis()).toBe(31000);
  expect(scores.meta.tFirstSub).toBe(1000);
});
test('rejects self answers, nonplayers, wrong answers and timestamps outside the turn', () => {
  const invalid = [answer('judge', 1000), answer('outsider', 1000), answer('a', -1), answer('a', 60001),
    { ...answer('a', 1000), verdict: 'WRONG' as const }, { ...answer('a', 1000), submittedAt: null as any }];
  expect(computeScores(round, invalid, ['judge', 'a']).perPlayerScores).toEqual({ judge: 0 });
});
test('the final star grade changes both guesser and judge points', () => {
  const low = computeScores(round, [answer('a', 30000, 1)], ['judge', 'a', 'b']);
  const high = computeScores(round, [answer('a', 30000, 3)], ['judge', 'a', 'b']);
  expect(low.perPlayerScores).toEqual({ a: 35, judge: 17 });
  expect(high.perPlayerScores).toEqual({ a: 95, judge: 50 });
});
test('judge scores stay normalized across group sizes and are zero without successes', () => {
  expect(computeScores(round, [answer('a', 0)], ['judge', 'a']).perPlayerScores.judge).toBe(100);
  expect(computeScores(round, [answer('a', 0), answer('b', 0)], ['judge', 'a', 'b']).perPlayerScores.judge).toBe(100);
  expect(computeScores(round, [], ['judge', 'a']).perPlayerScores.judge).toBe(0);
  expect(computeScores(round, [], ['judge']).perPlayerScores.judge).toBe(0);
});
test('legacy correct answers keep the highest grade and ties have a stable order', () => {
  const a = { ...answer('a', 0), stars: undefined };
  const b = answer('b', 0);
  expect(computeScores(round, [b, a], ['judge', 'a', 'b']).rankOrder).toEqual(['a', 'b', 'judge']);
  expect(computeScores(round, [a], ['judge', 'a']).perPlayerScores.a).toBe(100);
});
