import {
  IonAvatar,
  IonAlert,
  IonModal,
  IonIcon,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonLabel,
  IonSpinner,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { UserAuthContext } from '../App';
import { useRoom } from '../game/useRoom';
import { useCurrentRound } from '../game/useCurrentRound';
import { useGuesses } from '../game/useGuesses';
import { leaveRoom } from '../game/roomOperations';
import { endGame } from '../game/roomOperations';
import { useRounds } from '../game/useRounds';
import { matchTurnCount, matchTurnNumber } from '../game/match';
import Standings from '../components/game/Standings';
import FinalStandings from '../components/game/FinalStandings';
import { trophyOutline } from 'ionicons/icons';
import './Room.css';
import { ThemeToggle } from '../theme/ThemeControls';
import { selectRoundImage, advanceRound } from '../game/roundOperations';
import { useRoundLifecycle } from '../game/useRoundLifecycle';
import Lobby from './_room/Lobby';
import TurnSetupModal from '../components/TurnSetupModal';
import TurnPlayback from '../components/game/TurnPlayback';
import Scoreboard from '../components/game/Scoreboard';
import type { DeckImageDoc, ImageModifier, RoundDoc } from '../types/database';
import { useVisualViewport } from '../utils/useVisualViewport';

interface RoomParams {
  code: string;
}

interface WaitingViewProps {
  judgeUid: string;
  players: { uid: string; displayName: string; photoURL: string }[];
  subtitle?: string;
}

const WaitingView: React.FC<WaitingViewProps> = ({ judgeUid, players, subtitle }) => {
  const judge = players.find((p) => p.uid === judgeUid);
  const initial = (judge?.displayName?.[0] || '?').toUpperCase();
  return (
    <div
      className="ion-text-center"
      style={{ padding: '64px 24px', maxWidth: '480px', margin: '0 auto' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <IonAvatar style={{ width: '80px', height: '80px' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: judge?.photoURL
                ? `url(${judge.photoURL}) center/cover`
                : '#3880ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '32px',
              fontWeight: 700,
            }}
          >
            {!judge?.photoURL && initial}
          </div>
        </IonAvatar>
      </div>
      <IonText style={{ fontSize: '18px', fontWeight: 600 }}>
        Esperando a {judge?.displayName || 'quien presenta'}…
      </IonText>
      {subtitle && (
        <div style={{ marginTop: '8px' }}>
          <IonText color="medium" style={{ fontSize: '14px' }}>
            {subtitle}
          </IonText>
        </div>
      )}
    </div>
  );
};

const RoomContainer: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  useVisualViewport(pageRef);
  const { code } = useParams<RoomParams>();
  const history = useHistory();
  const userAuth = useContext(UserAuthContext);
  const { room, loading, error: roomError } = useRoom(code);
  const currentRound = useCurrentRound(
    code,
    room && (room.state === 'PLAYING' || room.state === 'SCOREBOARD')
      ? room.roundIndex
      : null
  );

  const currentUid = userAuth?.user?.uid ?? '';
  const [showScores, setShowScores] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actionError, setActionError] = useState('');
  const { rounds } = useRounds(code);
  const matchRounds = rounds.filter(r => r.roundIndex >= (room?.gameStartRoundIndex || 0));
  const currentUserName = userAuth?.user?.displayName ?? '';

  const isHost = useMemo(() => {
    return !!room && currentUid === room.hostUid;
  }, [room, currentUid]);

  const roomGameState =
    !!room && (room.state === 'PLAYING' || room.state === 'SCOREBOARD');
  const roundIdForGuesses = currentRound?.id ?? `round-${room?.roundIndex ?? 0}`;
  const { guesses } = useGuesses(
    roomGameState ? code : '',
    roomGameState ? roundIdForGuesses : ''
  );

  const isJudge = !!currentRound && currentUid === currentRound.judgeUid;

  const judgePlayer = useMemo(() => {
    if (!room || !currentRound) return null;
    return room.players.find((p) => p.uid === currentRound.judgeUid) ?? null;
  }, [room, currentRound]);

  useRoundLifecycle({
    code,
    round: currentRound ?? ({} as RoundDoc),
    room: room ?? ({} as any),
    currentUid,
  });

  useEffect(() => {
    if (!room || !isHost || !roomGameState || !currentRound) return;
    if (room.players.length < 2 || !room.players.some(p => p.uid === currentRound.judgeUid)) {
      endGame(code, currentUid).catch(() => setActionError('No se pudo cerrar la partida tras la salida de un jugador.'));
    }
  }, [room, isHost, roomGameState, currentRound, code, currentUid]);

  const handleLeave = async () => {
    if (!userAuth) return;
    try {
      await leaveRoom(code, userAuth.user.uid);
      history.push('/home');
    } catch (e) {
      setActionError('No se pudo salir de la sala. Inténtalo de nuevo.');
    }
  };

  // Keep a confirmed selection locked across transient round snapshots.
  // The modal owns the pending state and retains its preview on failure.
  const [submittedRoundIndex, setSubmittedRoundIndex] = useState<number | null>(null);

  useEffect(() => {
    setSubmittedRoundIndex(null);
    setSetupOpen(true);
  }, [room?.roundIndex]);

  const handleSelectImage = useCallback(
    async (deckImage: DeckImageDoc, modifier: ImageModifier) => {
      if (!room || !currentRound || !isJudge) throw new Error('El turno ya no está disponible.');
      setActionError('');
      try {
        await selectRoundImage(
          code,
          room.roundIndex,
          currentRound.judgeUid,
          deckImage,
          modifier
        );
        setSubmittedRoundIndex(room.roundIndex);
        setSetupOpen(false);
      } catch (e) {
        setSubmittedRoundIndex(null);
        throw e;
      }
    },
    [code, room, currentRound, isJudge]
  );

  const handleNextTurn = useCallback(async () => {
    if (!room || !isHost) return;
    // The transaction resolves the next presenter and the match ending from live data.
    await advanceRound(code, room.roundIndex + 1, '');
  }, [code, room, isHost]);

  const renderRoundBody = () => {
    if (!room || !currentRound) {
      return (
        <div className="ion-text-center ion-padding">
          <IonSpinner aria-label="Preparando el siguiente turno" />
          <div style={{ marginTop: '40px' }}>
            <IonText color="medium">Preparando el siguiente turno…</IonText>
          </div>
        </div>
      );
    }

    switch (currentRound.state) {
      case 'TURN_START': {
        if (isJudge) {
          return (
            <>
              <WaitingView
                judgeUid={currentRound.judgeUid}
                players={room.players}
                subtitle="¡Te toca presentar! Elige una imagen de tu mazo."
              />
              {!setupOpen && <div className="ion-text-center"><IonButton onClick={() => setSetupOpen(true)}>Elegir imagen</IonButton></div>}
            </>
          );
        }
        return (
          <WaitingView
            judgeUid={currentRound.judgeUid}
            players={room.players}
            subtitle="El presentador está eligiendo una imagen…"
          />
        );
      }
      case 'PROCESSING':
      case 'IN_PROGRESS':
      case 'ADJUDICATION':
      case 'ADJUDICATION_CLOSED': {
        return (
          <div style={{ height: '100%', width: '100%' }}>
            <TurnPlayback
              key={`${code}:${currentRound.roundIndex}`}
              code={code}
              round={currentRound}
              currentUid={currentUid}
              currentUserName={currentUserName}
              isJudge={!!isJudge}
              judgeName={judgePlayer?.displayName ?? 'Presentador'}
              players={room.players}
            />
          </div>
        );
      }
      case 'SCORED':
      case 'SCOREBOARD': {
        const perPlayerScores = currentRound.results?.perPlayerScores ?? {};
        const rankOrder = currentRound.results?.rankOrder ?? [];
        return (
          <Scoreboard
            key={currentRound.id}
            room={room}
            round={currentRound}
            guesses={guesses}
            players={room.matchPlayers || room.players}
            perPlayerScores={perPlayerScores}
            rankOrder={rankOrder}
            onNextTurn={handleNextTurn}
            isHost={isHost}
            currentUid={currentUid}
          />
        );
      }
      default:
        return null;
    }
  };

  const titleText = room?.state === 'LOBBY' ? 'Sala de espera'
    : room?.state === 'ENDED' ? 'Resultados finales'
    : room ? `Turno ${matchTurnNumber(room)} / ${matchTurnCount(room)}${isJudge ? ' · Presentas tú' : ''}` : 'ImagiPIC';
  const playbackActive = !!currentRound && ['PROCESSING', 'IN_PROGRESS', 'ADJUDICATION', 'ADJUDICATION_CLOSED'].includes(currentRound.state);

  return (
    <IonPage ref={pageRef} className="game-room">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonChip color="medium" style={{ marginLeft: '8px' }}>
              <IonLabel style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
                {code}
              </IonLabel>
            </IonChip>
          </IonButtons>
          <IonTitle>{titleText}</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
            {room && <IonButton aria-label="Ver puntuaciones" onClick={() => setShowScores(true)}><IonIcon slot="start" icon={trophyOutline} /><span className="scores-button-label">Puntos</span></IonButton>}
            <IonButton fill="clear" color="medium" onClick={() => setConfirmLeave(true)}>
              Salir
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={!playbackActive}>
        {actionError && <div role="alert" className="game-error room-error">{actionError}<IonButton size="small" fill="clear" onClick={() => setActionError('')}>Cerrar</IonButton></div>}
        {!loading && (!room || !room.players.some(p => p.uid === currentUid)) ? (
          <div className="game-shell ion-text-center"><h1>{room ? 'Ya no estás en esta sala' : 'No pudimos abrir la sala'}</h1><p>{roomError ? 'Comprueba tu conexión y vuelve a intentarlo.' : 'Vuelve al inicio para crear una sala o unirte con un código.'}</p><IonButton onClick={() => history.push('/home')}>Volver al inicio</IonButton></div>
        ) : loading || !room ? (
          <div className="ion-text-center ion-padding">
            <IonSpinner aria-label="Cargando sala" />
            <div style={{ marginTop: '40px' }}>
              <IonText color="medium">Cargando sala…</IonText>
            </div>
          </div>
        ) : room.state === 'LOBBY' ? (
          <Lobby code={code} room={room} />
        ) : room.state === 'PLAYING' || room.state === 'SCOREBOARD' ? (
          <div style={{ height: '100%', width: '100%' }}>{renderRoundBody()}</div>
        ) : room.state === 'ENDED' ? (
          <FinalStandings room={room} rounds={matchRounds} currentUid={currentUid} onLeave={handleLeave} />
        ) : null}
      </IonContent>
      {/* Keep Ionic's overlay mounted through round snapshot transitions so
          it can dismiss and release its backdrop/focus lock normally. */}
      <TurnSetupModal
        isOpen={roomGameState && currentRound?.state === 'TURN_START' && isJudge && setupOpen}
        judgeUid={currentRound?.judgeUid || ''}
        currentUserUid={currentUid}
        onSelectImage={handleSelectImage}
        onDismiss={() => setSetupOpen(false)}
        ownerUid={currentRound?.judgeUid || ''}
        selectionLocked={submittedRoundIndex !== null && submittedRoundIndex === currentRound?.roundIndex}
      />
      <IonModal isOpen={showScores} onDidDismiss={() => setShowScores(false)} className="scores-modal">
        <IonHeader><IonToolbar><IonTitle>Puntuaciones</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowScores(false)}>Cerrar</IonButton></IonButtons></IonToolbar></IonHeader>
        <IonContent className="ion-padding">{room && <><p className="game-hint">Los puntos se actualizan al terminar cada turno.</p><Standings players={room.state === 'LOBBY' ? room.players : room.matchPlayers || room.players} scores={room.cumulativeScores || {}} currentUid={currentUid} rounds={matchRounds.filter(r => !!r.results)} />{isHost && roomGameState && <div className="end-match-action"><IonButton fill="clear" color="danger" onClick={() => setConfirmEnd(true)}>Terminar la partida ahora</IonButton><p className="game-hint">Se conservarán los puntos de los turnos ya completados.</p></div>}</>}</IonContent>
      </IonModal>
      <IonAlert isOpen={confirmLeave} header="¿Salir de la sala?" message="Dejarás esta partida y volverás al inicio." buttons={[{ text: 'Seguir jugando', role: 'cancel' }, { text: 'Salir', handler: () => { handleLeave(); } }]} onDidDismiss={() => setConfirmLeave(false)} />
      <IonAlert isOpen={confirmEnd} header="¿Terminar la partida?" message="Todos verán la clasificación final. El turno actual no sumará puntos si aún no terminó." buttons={[{ text: 'Cancelar', role: 'cancel' }, { text: 'Ver final', handler: () => { if (room) endGame(code, currentUid).then(() => setShowScores(false)).catch(() => setActionError('No se pudo terminar la partida. Inténtalo de nuevo.')); } }]} onDidDismiss={() => setConfirmEnd(false)} />
    </IonPage>
  );
};

export { RoomContainer };
export default RoomContainer;
