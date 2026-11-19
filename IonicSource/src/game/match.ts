import type { RoomDoc, RoomPlayer } from '../types/database';

export const DEFAULT_ROUNDS_PER_GAME = 2;

export function eligibleJudges(room: Pick<RoomDoc, 'players' | 'turnOrder'>): string[] {
  return room.turnOrder.filter(uid => room.players.some(p => p.uid === uid && !p.skipJudge));
}

export function matchTurnCount(room: RoomDoc): number {
  return room.totalTurns || Math.max(1, eligibleJudges(room).length) * (room.roundsPerGame || DEFAULT_ROUNDS_PER_GAME);
}

export function matchTurnNumber(room: RoomDoc): number {
  return room.roundIndex - (room.gameStartRoundIndex || 0) + 1;
}

export function isLastTurn(room: RoomDoc): boolean {
  return matchTurnNumber(room) >= matchTurnCount(room);
}

export function rankPlayers(players: RoomPlayer[], scores: Record<string, number>) {
  const sorted = [...players].sort((a, b) => (scores[b.uid] || 0) - (scores[a.uid] || 0) || a.displayName.localeCompare(b.displayName));
  return sorted.map((player) => ({
    player,
    score: scores[player.uid] || 0,
    rank: sorted.findIndex(p => (scores[p.uid] || 0) === (scores[player.uid] || 0)) + 1,
  }));
}
