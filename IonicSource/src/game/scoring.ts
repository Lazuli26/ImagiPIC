import type { RoundDoc, GuessDoc, CorrectStars } from '../types/database';

export const STAR_BASE_POINTS: Record<CorrectStars, number> = { 1: 40, 2: 60, 3: 80 };
export const MAX_SPEED_BONUS = 20;
export const STAR_DESCRIPTIONS: Record<CorrectStars, string> = { 1: 'Idea general', 2: 'Reconocible, con detalles pendientes', 3: 'Respuesta precisa o sinónimo equivalente' };

export function correctStars(guess: Pick<GuessDoc, 'verdict' | 'stars'>): CorrectStars | null {
  if (guess.verdict !== 'CORRECT') return null;
  if (guess.stars == null) return 3; // Legacy answers without a star grade.
  return guess.stars === 1 || guess.stars === 2 || guess.stars === 3 ? guess.stars : null;
}

export interface ScoreResult {
  perPlayerScores: Record<string, number>;
  rankOrder: string[];
  breakdown: Record<string, { base: number; speed: number }>;
  meta: {
    tFirstSub: number | null;
    roundEndsAtMs: number;
    guessesCloseAtMs: number;
    guesserCount: number;
    bestByUid: Record<string, GuessDoc>;
  };
}

// Accuracy: 40/60/80; speed: up to 20 against the original turn duration.
// A weaker grade can tie, but never exceed, the next grade through speed alone.
export function computeScores(round: RoundDoc, guesses: GuessDoc[], playerUids?: string[]): ScoreResult {
  const startedMs = round.startedAt?.toMillis?.() ?? NaN;
  const durationMs = Math.max(0, round.roundTimerSecs * 1000);
  const roundEndsAtMs = startedMs + durationMs;
  const reviewStartedMs = round.adjudicationStartedAt?.toMillis?.();
  const guessesCloseAtMs = Number.isFinite(reviewStartedMs) ? Math.min(roundEndsAtMs, reviewStartedMs!) : roundEndsAtMs;
  const guessers = new Set((round.participantUids || playerUids || guesses.map(guess => guess.uid)).filter(uid => uid !== round.judgeUid));
  const bestByUid: Record<string, GuessDoc> = {};
  const perPlayerScores: Record<string, number> = {};
  const breakdown: ScoreResult['breakdown'] = {};
  let tFirstSub: number | null = null;

  for (const guess of guesses) {
    const stars = correctStars(guess);
    const submittedMs = guess.submittedAt?.toMillis?.() ?? NaN;
    if (!stars || !guessers.has(guess.uid) || !Number.isFinite(startedMs) || !Number.isFinite(submittedMs)
      || !Number.isFinite(durationMs) || durationMs <= 0 || submittedMs < startedMs || submittedMs > guessesCloseAtMs) continue;
    tFirstSub = Math.min(tFirstSub ?? submittedMs, submittedMs);
    const speedBonus = Math.round(MAX_SPEED_BONUS * (roundEndsAtMs - submittedMs) / durationMs);
    const points = STAR_BASE_POINTS[stars] + speedBonus;
    const previous = bestByUid[guess.uid];
    if (!previous || points > perPlayerScores[guess.uid]
      || (points === perPlayerScores[guess.uid] && submittedMs < previous.submittedAt.toMillis())) {
      bestByUid[guess.uid] = guess;
      perPlayerScores[guess.uid] = points;
      breakdown[guess.uid] = { base: STAR_BASE_POINTS[stars], speed: speedBonus };
    }
  }

  // Share the group's accuracy, including zero for each unsolved participant.
  // Only guessers earn speed: the judge controls when/how fast shapes appear.
  const quality = Object.values(breakdown).reduce((sum, points) => sum + points.base, 0);
  perPlayerScores[round.judgeUid] = guessers.size ? Math.round(quality / guessers.size) : 0;
  breakdown[round.judgeUid] = { base: perPlayerScores[round.judgeUid], speed: 0 };
  const rankOrder = Object.keys(perPlayerScores).sort((a, b) => {
    const scoreDiff = perPlayerScores[b] - perPlayerScores[a];
    if (scoreDiff) return scoreDiff;
    const aMs = bestByUid[a]?.submittedAt.toMillis() ?? Infinity;
    const bMs = bestByUid[b]?.submittedAt.toMillis() ?? Infinity;
    return (aMs === bMs ? 0 : aMs - bMs) || a.localeCompare(b);
  });
  return { perPlayerScores, rankOrder, breakdown, meta: { tFirstSub, roundEndsAtMs, guessesCloseAtMs, guesserCount: guessers.size, bestByUid } };
}
