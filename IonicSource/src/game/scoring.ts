import type { RoundDoc, GuessDoc, CorrectStars } from '../types/database';

export const STAR_BASE_POINTS: Record<CorrectStars, number> = { 1: 30, 2: 60, 3: 90 };
export const MAX_SPEED_BONUS = 10;

export function correctStars(guess: Pick<GuessDoc, 'verdict' | 'stars'>): CorrectStars | null {
  if (guess.verdict !== 'CORRECT') return null;
  return guess.stars === 1 || guess.stars === 2 ? guess.stars : 3;
}

export interface ScoreResult {
  perPlayerScores: Record<string, number>;
  rankOrder: string[];
  meta: {
    tFirstSub: number | null;
    roundEndsAtMs: number;
    bestByUid: Record<string, GuessDoc>;
  };
}

// Each star level has its own points band. Speed adds at most ten points,
// measured against the whole turn, so a late first answer is never worth 100.
export function computeScores(round: RoundDoc, guesses: GuessDoc[], playerUids?: string[]): ScoreResult {
  const startedMs = round.startedAt?.toMillis?.() ?? NaN;
  const durationMs = Math.max(0, round.roundTimerSecs * 1000);
  const roundEndsAtMs = startedMs + durationMs;
  const guessers = new Set((playerUids || guesses.map(guess => guess.uid)).filter(uid => uid !== round.judgeUid));
  const bestByUid: Record<string, GuessDoc> = {};
  const perPlayerScores: Record<string, number> = {};
  let tFirstSub: number | null = null;

  for (const guess of guesses) {
    const stars = correctStars(guess);
    const submittedMs = guess.submittedAt?.toMillis?.() ?? NaN;
    if (!stars || !guessers.has(guess.uid) || !Number.isFinite(startedMs) || !Number.isFinite(submittedMs)
      || durationMs <= 0 || submittedMs < startedMs || submittedMs > roundEndsAtMs) continue;
    tFirstSub = Math.min(tFirstSub ?? submittedMs, submittedMs);
    const speedBonus = Math.round(MAX_SPEED_BONUS * (roundEndsAtMs - submittedMs) / durationMs);
    const points = STAR_BASE_POINTS[stars] + speedBonus;
    const previous = bestByUid[guess.uid];
    if (!previous || points > perPlayerScores[guess.uid]
      || (points === perPlayerScores[guess.uid] && submittedMs < previous.submittedAt.toMillis())) {
      bestByUid[guess.uid] = guess;
      perPlayerScores[guess.uid] = points;
    }
  }

  // A readable image earns its presenter up to 100, independently of group
  // size. Unsolved players contribute zero; stars contribute 1/3, 2/3 or 1.
  const quality = Object.values(bestByUid).reduce((sum, guess) => sum + correctStars(guess)!, 0);
  perPlayerScores[round.judgeUid] = guessers.size ? Math.round(100 * quality / (3 * guessers.size)) : 0;
  const rankOrder = Object.keys(perPlayerScores).sort((a, b) => {
    const scoreDiff = perPlayerScores[b] - perPlayerScores[a];
    if (scoreDiff) return scoreDiff;
    const aMs = bestByUid[a]?.submittedAt.toMillis() ?? Infinity;
    const bMs = bestByUid[b]?.submittedAt.toMillis() ?? Infinity;
    return (aMs === bMs ? 0 : aMs - bMs) || a.localeCompare(b);
  });
  return { perPlayerScores, rankOrder, meta: { tFirstSub, roundEndsAtMs, bestByUid } };
}
