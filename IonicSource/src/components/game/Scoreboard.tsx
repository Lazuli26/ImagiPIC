import { IonButton, IonProgressBar } from '@ionic/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GuessDoc, RoomPlayer, RoundDoc, RoomDoc } from '../../types/database';
import { decodeAllToSvgRows, unflattenShapes } from '../../utils/compactShapeCodec';
import { isLastTurn, matchTurnCount, matchTurnNumber } from '../../game/match';
import Standings from './Standings';
import { imageModifierFilter } from '../../game/imageModifiers';

interface ScoreboardProps {
  room: RoomDoc;
  round: RoundDoc;
  guesses: GuessDoc[];
  players: RoomPlayer[];
  perPlayerScores: Record<string, number>;
  rankOrder: string[];
  onNextTurn: () => Promise<void>;
  isHost: boolean;
  currentUid?: string;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ room, round, guesses, players, perPlayerScores, rankOrder, onNextTurn, isHost, currentUid }) => {
  const duration = room.scoreboardTimerSecs == null ? 10 : room.scoreboardTimerSecs;
  const [countdown, setCountdown] = useState(duration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempted = useRef(false);
  const fallbackStartedAt = useRef(Date.now());
  const lastTurn = isLastTurn(room);
  const nextLabel = lastTurn ? 'Ver resultados finales' : 'Siguiente turno';
  const rows = useMemo(() => decodeAllToSvgRows(unflattenShapes(round.shapesCompactCopy || []), round.width || 512, round.height || 512), [round.shapesCompactCopy, round.width, round.height]);
  const correctUids = rankOrder.filter(uid => uid !== round.judgeUid && perPlayerScores[uid] > 0);
  const correctCount = correctUids.length;
  const firstUid = guesses.filter(guess => guess.verdict === 'CORRECT' && correctUids.includes(guess.uid))
    .sort((a, b) => (a.submittedAt?.toMillis?.() ?? Infinity) - (b.submittedAt?.toMillis?.() ?? Infinity))[0]?.uid;

  const advance = async () => {
    if (attempted.current || !isHost) return;
    attempted.current = true; setBusy(true); setError('');
    try { await onNextTurn(); }
    catch (e) { setError('No se pudo continuar. Vuelve a intentarlo.'); }
    finally { setBusy(false); }
  };
  // A single host-owned clock advances the match. Its deadline survives remounts
  // and is shared by everyone through the scoring transaction's timestamp.
  useEffect(() => {
    if (!duration) return;
    const tick = () => {
      const start = round.scoredAt?.toMillis?.() || fallbackStartedAt.current;
      const remaining = Math.max(0, Math.ceil((start + duration * 1000 - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) advance();
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
    // advance is intentionally read through this effect's current host callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, round.scoredAt, isHost, onNextTurn]);

  return <div className="game-shell round-results">
    <div className="results-heading"><span className="game-eyebrow">TURNO {matchTurnNumber(room)} DE {matchTurnCount(room)} COMPLETADO</span><h1>{correctCount ? '¡Bien visto!' : 'Esta imagen se resistió'}</h1><p>{correctCount} de {players.filter(p => p.uid !== round.judgeUid).length} jugadores acertaron.{lastTurn ? ' La partida ha terminado.' : ' La próxima imagen ya te espera.'}</p></div>
    <div className="results-grid">
      <section className="game-card reveal-card"><h2>La imagen completa</h2><div className="result-image">{rows.length > 0 ? <svg className="geometric-image" viewBox={`0 0 ${round.width || 512} ${round.height || 512}`} preserveAspectRatio="xMidYMid meet" style={{ filter: imageModifierFilter(round.imageModifier) }} role="img" aria-label="Imagen completa del turno" dangerouslySetInnerHTML={{ __html: rows.join('\n') }} /> : <p>La imagen no está disponible.</p>}</div><p>Presentó: <strong>{players.find(p => p.uid === round.judgeUid)?.displayName || 'Jugador'}</strong></p>{firstUid && <p className="game-notice">⚡ Primer acierto: <strong>{players.find(p => p.uid === firstUid)?.displayName || 'Jugador'}</strong> · +{perPlayerScores[firstUid] || 0} pts</p>}<p className="game-notice">Imagen del juez: <strong>+{perPlayerScores[round.judgeUid] || 0} pts</strong></p><p className="game-hint">El juez recibe hasta 100 puntos según la proporción de jugadores que aciertan y sus estrellas. Adivinar suma 30, 60 o 90 puntos, más hasta 10 por rapidez.</p></section>
      <section className="game-card"><div className="game-card-heading"><h2>Así va la partida</h2><span className="game-pill">Puntos totales</span></div><Standings players={players} scores={room.cumulativeScores || {}} roundScores={perPlayerScores} judgeUid={round.judgeUid} currentUid={currentUid} />
        <div className="results-next" aria-live="polite">{error ? <p className="game-error" role="alert">{error}</p> : duration > 0 ? <><p>{lastTurn ? 'Resultados finales' : 'Siguiente turno'} en <strong>{countdown}s</strong></p><IonProgressBar value={countdown / duration} /></> : <p>El anfitrión decide cuándo continuar.</p>}
          {isHost && <IonButton expand="block" size="large" disabled={busy} onClick={() => { attempted.current = false; advance(); }}>{busy ? 'Continuando…' : nextLabel}</IonButton>}
          {!isHost && countdown === 0 && duration > 0 && <p className="game-hint">Esperando al anfitrión…</p>}
        </div>
      </section>
    </div>
  </div>;
};
export default Scoreboard;
export { Scoreboard };
