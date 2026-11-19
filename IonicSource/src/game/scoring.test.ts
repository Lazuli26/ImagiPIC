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
  expect(scores.perPlayerScores).toEqual({ a: 80, judge: 40 });
});
test('quality takes priority over speed and every correct level earns points', () => {
  const scores = computeScores(round, [answer('a', 0, 1), answer('b', 30000, 2), answer('c', 60000, 3)], ['judge', 'a', 'b', 'c']);
  expect(scores.perPlayerScores).toEqual({ a: 60, b: 70, c: 80, judge: 60 });
  expect(scores.rankOrder).toEqual(['c', 'b', 'a', 'judge']);
});
test('counts each player once and chooses the highest scoring answer', () => {
  const scores = computeScores(round, [answer('a', 0, 1), answer('a', 30000, 3), answer('a', 40000, 3)], ['judge', 'a']);
  expect(scores.perPlayerScores).toEqual({ a: 90, judge: 80 });
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
  expect(low.perPlayerScores).toEqual({ a: 50, judge: 20 });
  expect(high.perPlayerScores).toEqual({ a: 90, judge: 40 });
});
test('judge scores stay normalized across group sizes and are zero without successes', () => {
  expect(computeScores(round, [answer('a', 0)], ['judge', 'a']).perPlayerScores.judge).toBe(80);
  expect(computeScores(round, [answer('a', 0), answer('b', 0)], ['judge', 'a', 'b']).perPlayerScores.judge).toBe(80);
  expect(computeScores(round, [], ['judge', 'a']).perPlayerScores.judge).toBe(0);
  expect(computeScores(round, [], ['judge']).perPlayerScores.judge).toBe(0);
});
test('legacy correct answers keep the highest grade and ties have a stable order', () => {
  const a = { ...answer('a', 0), stars: undefined };
  const b = answer('b', 0);
  expect(computeScores(round, [b, a], ['judge', 'a', 'b']).rankOrder).toEqual(['a', 'b', 'judge']);
  expect(computeScores(round, [a], ['judge', 'a']).perPlayerScores.a).toBe(100);
});


test('awards are normalized by turn length and never reward delayed judging', () => {
  const short = computeScores({ ...round, roundTimerSecs: 30 }, [answer('a', 15000)], ['judge', 'a']);
  const long = computeScores({ ...round, roundTimerSecs: 120 }, [{ ...answer('a', 60000), verdictAt: time(999999) }], ['judge', 'a']);
  expect(short.perPlayerScores).toEqual({ a: 90, judge: 80 });
  expect(long.perPlayerScores).toEqual(short.perPlayerScores);
  expect(long.breakdown.a).toEqual({ base: 80, speed: 10 });
});

test('the frozen roster includes unsolved and departed players, but not later arrivals', () => {
  const frozen = { ...round, participantUids: ['judge', 'a', 'b', 'c', 'd'] };
  const result = computeScores(frozen, [answer('a', 0), answer('b', 0, 2), answer('c', 0, 1), answer('new', 0)], ['judge', 'a', 'new']);
  expect(result.perPlayerScores.judge).toBe(45);
  expect(result.perPlayerScores.new).toBeUndefined();
  expect(result.meta.guesserCount).toBe(4);
});

test('early closure rejects later answers and preserves the original speed scale', () => {
  const early = { ...round, adjudicationStartedAt: time(21000) };
  const result = computeScores(early, [answer('a', 10000), answer('b', 20001)], ['judge', 'a', 'b']);
  expect(result.perPlayerScores).toEqual({ a: 97, judge: 40 });
  expect(result.breakdown.a).toEqual({ base: 80, speed: 17 });
  expect(result.perPlayerScores.a).toBe(computeScores(round, [answer('a', 10000)], ['judge', 'a', 'b']).perPlayerScores.a);
});

test('speed never makes a lower star grade beat a higher one and every score stays within bounds', () => {
  for (const grade of [1, 2, 3] as CorrectStars[]) {
    let previous = 101;
    for (let elapsed = 0; elapsed <= 60000; elapsed += 1000) {
      const result = computeScores(round, [answer('a', elapsed, grade)], ['judge', 'a']);
      const score = result.perPlayerScores.a;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeLessThanOrEqual(previous);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(result.perPlayerScores.judge).toBeLessThanOrEqual(80);
      previous = score;
    }
  }
  expect(computeScores(round, [answer('a', 0, 1), answer('b', 60000, 2)], ['judge', 'a', 'b']).perPlayerScores).toEqual({ a: 60, b: 60, judge: 50 });
});

test('invalid star grades and invalid durations cannot produce points or NaN scores', () => {
  for (const stars of [0, 4, 1.5, '3', NaN]) {
    expect(computeScores(round, [{ ...answer('a', 1000), stars } as any], ['judge', 'a']).perPlayerScores).toEqual({ judge: 0 });
  }
  for (const duration of [0, -1, NaN, Infinity]) {
    expect(computeScores({ ...round, roundTimerSecs: duration }, [answer('a', 1000)], ['judge', 'a']).perPlayerScores).toEqual({ judge: 0 });
  }
});
