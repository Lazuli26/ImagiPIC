import { eligibleJudges, isLastTurn, matchTurnCount, matchTurnNumber, rankPlayers } from './match';
import { RoomDoc, RoomPlayer } from '../types/database';

const players = ['Ana', 'Beto', 'Caro'].map((displayName, i) => ({ uid: String(i), displayName, skipJudge: i === 1 })) as RoomPlayer[];
const room = { players, turnOrder: ['0', '1', '2'], roundIndex: 0, roundsPerGame: 2 } as RoomDoc;

test('a round gives each eligible presenter exactly one turn', () => {
  expect(eligibleJudges(room)).toEqual(['0', '2']);
  expect(matchTurnCount(room)).toBe(4);
  expect(isLastTurn({ ...room, roundIndex: 2 })).toBe(false);
  expect(isLastTurn({ ...room, roundIndex: 3 })).toBe(true);
});
test('the match length stays fixed when a player leaves', () => {
  expect(matchTurnCount({ ...room, players: players.slice(0, 1), totalTurns: 4 })).toBe(4);
});
test('a rematch uses a new index but starts its turn counter at one', () => {
  const rematch = { ...room, gameStartRoundIndex: 12, roundIndex: 12, totalTurns: 4 };
  expect(matchTurnNumber(rematch)).toBe(1);
  expect(isLastTurn(rematch)).toBe(false);
  expect(isLastTurn({ ...rematch, roundIndex: 15 })).toBe(true);
});
test('standings include zero scores and award equal ranks for ties', () => {
  expect(rankPlayers(players, { '0': 100, '2': 100 }).map(({ player, rank, score }) => [player.displayName, rank, score])).toEqual([
    ['Ana', 1, 100], ['Caro', 1, 100], ['Beto', 3, 0],
  ]);
});
test('old rooms get a finite default match', () => {
  expect(matchTurnCount({ ...room, roundsPerGame: undefined })).toBe(4);
});
