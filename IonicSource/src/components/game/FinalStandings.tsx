import { IonButton } from '@ionic/react';
import React, { useState } from 'react';
import type { RoomDoc, RoundDoc } from '../../types/database';
import { rankPlayers } from '../../game/match';
import { returnToLobby } from '../../game/roomOperations';
import Standings from './Standings';

const FinalStandings: React.FC<{ room: RoomDoc; rounds: RoundDoc[]; currentUid: string; onLeave: () => void }> = ({ room, rounds, currentUid, onLeave }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const players = room.matchPlayers || room.players;
  const ranked = rankPlayers(players, room.cumulativeScores || {});
  const winners = ranked.filter(p => p.rank === 1 && p.score > 0);
  const scoredTurns = rounds.filter(r => r.results).length;
  const isHost = currentUid === room.hostUid;
  return <div className="game-shell final-results">
    <div className="results-heading"><div className="final-trophy" aria-hidden="true">🏆</div><span className="game-eyebrow">PARTIDA TERMINADA</span><h1>{winners.length > 1 ? '¡Victoria compartida!' : winners.length === 1 ? `¡${winners[0].player.displayName} gana!` : '¡Gracias por jugar!'}</h1><p>{winners.length > 1 ? winners.map(p => p.player.displayName).join(', ') + ` · ${winners[0].score} puntos` : winners.length ? `${winners[0].score} puntos y muy buen ojo.` : 'Nadie sumó puntos esta vez. La revancha puede cambiarlo todo.'}</p><span className="game-pill">{scoredTurns} {scoredTurns === 1 ? 'turno puntuado' : 'turnos puntuados'} · {players.length} jugadores</span></div>
    <section className="game-card final-table"><h2>Clasificación final</h2><Standings players={players} scores={room.cumulativeScores || {}} currentUid={currentUid} rounds={rounds.filter(r => !!r.results)} />
      {error && <p className="game-error" role="alert">{error}</p>}
      <div className="final-actions">{isHost && <IonButton size="large" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await returnToLobby(room.code, currentUid); } catch (e) { setError('No se pudo preparar la revancha. Inténtalo de nuevo.'); } finally { setBusy(false); } }}>{busy ? 'Preparando…' : 'Preparar revancha'}</IonButton>}<IonButton fill="outline" size="large" disabled={busy} onClick={onLeave}>Salir de la sala</IonButton></div>
      <p className="game-hint">{isHost ? 'La revancha conserva el grupo y permite ajustar las reglas.' : 'El anfitrión puede preparar una revancha con el mismo grupo.'} Puedes quedarte a revisar las puntuaciones.</p>
    </section>
  </div>;
};
export default FinalStandings;
