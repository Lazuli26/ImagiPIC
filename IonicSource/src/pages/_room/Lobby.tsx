import { IonButton, IonIcon, IonToggle } from '@ionic/react';
import { copyOutline, personRemoveOutline, play, checkmarkCircleOutline } from 'ionicons/icons';
import ScoringRules from '../../components/game/ScoringRules';
import React, { useContext, useEffect, useState } from 'react';
import { UserAuthContext } from '../../App';
import type { RoomDoc } from '../../types/database';
import { kickPlayer, startGame, toggleSkipJudge, updateRoomSettings } from '../../game/roomOperations';
import { DEFAULT_ROUNDS_PER_GAME } from '../../game/match';
import { useDeck } from '../../game/useDeck';

interface LobbyProps { code: string; room: RoomDoc; }

const Lobby: React.FC<LobbyProps> = ({ code, room }) => {
  const userAuth = useContext(UserAuthContext);
  const uid = userAuth?.user.uid || '';
  const isHost = uid === room.hostUid;
  const { meta } = useDeck(uid);
  const [settings, setSettings] = useState({
    roundsPerGame: room.roundsPerGame || DEFAULT_ROUNDS_PER_GAME,
    roundTimerSecs: room.roundTimerSecs,
    graceTimerSecs: room.graceTimerSecs,
    maxPlayers: room.maxPlayers,
    scoreboardTimerSecs: room.scoreboardTimerSecs == null ? 10 : room.scoreboardTimerSecs,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  useEffect(() => {
    setSettings({ roundsPerGame: room.roundsPerGame || DEFAULT_ROUNDS_PER_GAME, roundTimerSecs: room.roundTimerSecs, graceTimerSecs: room.graceTimerSecs, maxPlayers: room.maxPlayers, scoreboardTimerSecs: room.scoreboardTimerSecs == null ? 10 : room.scoreboardTimerSecs });
  }, [room.roundsPerGame, room.roundTimerSecs, room.graceTimerSecs, room.maxPlayers, room.scoreboardTimerSecs]);
  const presenters = room.players.filter(p => !p.skipJudge).length;
  const totalTurns = presenters * settings.roundsPerGame;
  const minutes = Math.ceil(totalTurns * (settings.roundTimerSecs + settings.graceTimerSecs + settings.scoreboardTimerSecs) / 60);
  const self = room.players.find(p => p.uid === uid);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };
  const changeSetting = async (key: keyof typeof settings, value: number) => {
    const previousValue = settings[key];
    setSettings(current => ({ ...current, [key]: value }));
    if (!isHost) return;

    setBusy(true); setError('');
    try {
      const patch: Partial<typeof settings> = { [key]: value };
      await updateRoomSettings(code, uid, patch);
    } catch (e) {
      setSettings(current => current[key] === value ? { ...current, [key]: previousValue } : current);
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  const start = () => run(async () => {
    // Save the exact visible settings before starting, including rapid edits.
    await updateRoomSettings(code, uid, settings);
    await startGame(code, uid);
  });
  const changeRole = async (skip: boolean) => {
    if (roleBusy || skip === self?.skipJudge) return;
    setRoleBusy(true); setError('');
    try { await toggleSkipJudge(code, uid, skip); }
    catch (e) { setError('No se pudo cambiar tu rol. Inténtalo de nuevo.'); }
    finally { setRoleBusy(false); }
  };
  const setting = (key: keyof typeof settings, label: string, help: string, options: { value: number; label: string }[]) => (
    <label className="game-setting">
      <span>{label}<small>{help}</small></span>
      <select aria-label={label} value={settings[key]} disabled={!isHost || busy} onChange={e => changeSetting(key, Number(e.target.value))}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
  const seconds = (values: number[]) => values.map(value => ({ value, label: `${value} segundos` }));

  return <div className="game-shell lobby-shell">
    <section className="lobby-intro">
      <div><span className="game-eyebrow">QUE EMPIECE EL JUEGO</span><h1>Una imagen. Muchas ideas.</h1><p>Invita a tu grupo y prepara la próxima partida.</p><ScoringRules /></div>
      <div className="invite-card"><span>Código de sala</span><strong>{code}</strong>
        <IonButton fill="clear" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch (e) { setError('No se pudo copiar. Comparte el código que aparece arriba.'); } }}>
          <IonIcon slot="start" icon={copied ? checkmarkCircleOutline : copyOutline} />{copied ? '¡Copiado!' : 'Copiar código'}
        </IonButton>
      </div>
    </section>
    <div className="lobby-grid">
      <section className="game-card"><div className="game-card-heading"><h2>El grupo</h2><span className="game-pill">{room.players.length} / {settings.maxPlayers}</span></div>
        <div className="lobby-players">{room.players.map(player => <div className="lobby-player" key={player.uid}>
          <span className="player-avatar">{player.photoURL ? <img src={player.photoURL} alt="" /> : player.displayName[0]?.toUpperCase() || '?'}</span>
          <div className="player-description"><strong>{player.displayName}{player.uid === uid ? ' (tú)' : ''}</strong><small>{player.isHost ? '👑 Anfitrión · ' : ''}{player.skipJudge ? 'Solo adivina' : 'Presenta y adivina'}</small></div>
          {isHost && player.uid !== uid && <IonButton fill="clear" color="medium" disabled={busy} aria-label={`Expulsar a ${player.displayName}`} onClick={() => run(() => kickPlayer(code, uid, player.uid))}><IonIcon slot="icon-only" icon={personRemoveOutline} /></IonButton>}
        </div>)}</div>
        <label className="role-setting"><span><strong>Solo quiero adivinar</strong><small>No presentarás imágenes de tu mazo.</small></span><IonToggle aria-label="Solo quiero adivinar" checked={!!self?.skipJudge} disabled={roleBusy || busy} onIonChange={e => changeRole(e.detail.checked)} /></label>
        {meta?.count === 0 && !self?.skipJudge && <p className="game-notice">Tu mazo está vacío. Añade imágenes en «Deck» antes de presentar o elige solo adivinar.</p>}
        <div className="how-to-play"><h3>Así se juega</h3><ol><li>El presentador elige una imagen de su mazo.</li><li>La imagen aparece poco a poco. Los demás adivinan.</li><li>El presentador valida las respuestas. ¡Acertar antes da más puntos!</li></ol><p>Cada ronda da un turno a cada presentador. Las estrellas valoran qué tan precisa es la respuesta; acertar antes añade puntos por rapidez.</p><ScoringRules /></div>
      </section>
      <section className="game-card"><div className="game-card-heading"><h2>Tu partida, tus reglas</h2><span className="game-pill">{isHost ? 'Configura' : 'Anfitrión configura'}</span></div>
        {setting('roundsPerGame', 'Rondas', 'Cada presentador participa una vez por ronda.', [1, 2, 3, 4, 5].map(value => ({ value, label: `${value} ${value === 1 ? 'ronda' : 'rondas'}` })))}
        {setting('roundTimerSecs', 'Tiempo para adivinar', 'El reloj comienza al iniciar la imagen.', seconds(Array.from(new Set([15, 30, 45, 60, 90, 120, 180, settings.roundTimerSecs])).sort((a, b) => a - b)))}
        {setting('graceTimerSecs', 'Revisión de respuestas', 'Tiempo extra para validar los aciertos.', seconds(Array.from(new Set([10, 15, 20, 30, 45, 60, settings.graceTimerSecs])).sort((a, b) => a - b)))}
        {setting('scoreboardTimerSecs', 'Entre turnos', 'Cuánto tiempo ver los resultados.', [{ value: 0, label: 'El anfitrión continúa' }, ...seconds(Array.from(new Set([5, 10, 15, 20, 30, settings.scoreboardTimerSecs])).filter(Boolean).sort((a, b) => a - b))])}
        {setting('maxPlayers', 'Plazas de la sala', 'Entre 2 y 12 personas.', Array.from({ length: 11 }, (_, i) => ({ value: i + 2, label: `${i + 2} jugadores` })))}
        <div className="match-estimate"><strong>{totalTurns} turnos en total</strong><span>Unos {minutes} min + elección de imágenes</span></div>
        <p className="game-hint">{isHost ? 'Tus cambios se guardan y se comparten automáticamente.' : 'Los ajustes que cambia el anfitrión aparecen aquí en tiempo real.'}</p>
        {error && <p role="alert" className="game-error">{error}</p>}
        {isHost ? <div className="lobby-actions"><IonButton fill="outline" expand="block" disabled={busy || settings.maxPlayers < room.players.length} onClick={() => run(() => updateRoomSettings(code, uid, settings))}>Guardar configuración</IonButton><IonButton expand="block" size="large" disabled={busy || roleBusy || room.players.length < 2 || !presenters || settings.maxPlayers < room.players.length || (meta?.count === 0 && !self?.skipJudge)} onClick={start}><IonIcon slot="start" icon={play} />{busy ? 'Preparando…' : '¡A jugar!'}</IonButton></div> : <p className="game-notice" role="status">El anfitrión iniciará la partida cuando el grupo esté listo.</p>}
        {room.players.length < 2 && <p className="game-hint">Falta al menos una persona. Comparte el código para invitarla.</p>}
        {!presenters && <p className="game-error">Al menos una persona debe presentar imágenes.</p>}
        {settings.maxPlayers < room.players.length && <p className="game-error">Hay más jugadores que plazas. Aumenta la capacidad.</p>}
      </section>
    </div>
  </div>;
};
export default Lobby;
