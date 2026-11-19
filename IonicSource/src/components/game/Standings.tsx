import React from 'react';
import type { RoomPlayer, RoundDoc } from '../../types/database';
import { rankPlayers } from '../../game/match';

interface StandingsProps {
  players: RoomPlayer[];
  scores: Record<string, number>;
  currentUid?: string;
  judgeUid?: string;
  roundScores?: Record<string, number>;
  rounds?: RoundDoc[];
}

const Standings: React.FC<StandingsProps> = ({ players, scores, currentUid, judgeUid, roundScores, rounds }) => (
  <div className="standings-wrap">
    <table className="standings-table">
      <caption className="sr-only">Clasificación de la partida</caption>
      <thead><tr><th scope="col">Puesto</th><th scope="col">Jugador</th>{roundScores && <th scope="col">Turno</th>}<th scope="col">Total</th></tr></thead>
      <tbody>
        {rankPlayers(players, scores).map(({ player, score, rank }) => (
          <tr key={player.uid} className={player.uid === currentUid ? 'is-self' : ''}>
            <td><span className="rank-medal">{score > 0 && rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}</span></td>
            <th scope="row"><div className="standing-player">
              <span className="player-avatar">{player.photoURL ? <img src={player.photoURL} alt="" /> : (player.displayName[0] || '?').toUpperCase()}</span>
              <span>{player.displayName || 'Jugador'}{player.uid === currentUid && <small> Tú</small>}</span>
            </div></th>
            {roundScores && <td className="turn-points">{`+${roundScores[player.uid] || 0}`}{player.uid === judgeUid && <small> · Presentó</small>}</td>}
            <td><strong>{score}</strong><small> pts</small></td>
          </tr>
        ))}
        {!players.length && <tr><td colSpan={roundScores ? 4 : 3}>Todavía no hay jugadores.</td></tr>}
      </tbody>
    </table>
    {rounds && rounds.length > 0 && <details className="round-history">
      <summary>Puntuaciones por turno</summary>
      <div className="standings-wrap"><table className="standings-table history-table">
        <thead><tr><th scope="col">Jugador</th>{rounds.map((r, i) => <th key={r.id} scope="col">T{i + 1}</th>)}</tr></thead>
        <tbody>{rankPlayers(players, scores).map(({ player }) => <tr key={player.uid}>
          <th scope="row">{player.displayName}</th>{rounds.map(r => <td key={r.id}>{r.results?.perPlayerScores[player.uid] || 0}{r.judgeUid === player.uid && <small title="Presentó la imagen"> ★</small>}</td>)}
        </tr>)}</tbody>
      </table></div>
    </details>}
  </div>
);
export default Standings;
