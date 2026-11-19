import {
  IonButton,
  IonIcon,
  IonProgressBar,
  IonText,
} from '@ionic/react';
import { checkmarkCircleOutline, playSkipForward, stopCircle } from 'ionicons/icons';
import { arrayUnion, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../firebase/firebaseApp';
import type { RoundDoc, RoomPlayer } from '../../types/database';
import JudgeRhythmBar from './JudgeRhythmBar';
import GuessChatPanel from './GuessChatPanel';
import { useRoundShapes } from '../../game/useRoundShapes';
import { watchDocument } from '../../game/watchDocument';
import InlineSvgPreview from './InlineSvgPreview';
import { imageModifierFilter, NO_IMAGE_MODIFIER, seededShapeOrder } from '../../game/imageModifiers';

interface TurnPlaybackProps {
  code: string;
  round: RoundDoc;
  currentUid: string;
  currentUserName: string;
  isJudge: boolean;
  judgeName: string;
  players: RoomPlayer[];
}

function computeDisplayedStep(
  round: RoundDoc,
  now: number,
  svgRowsLen: number,
  clientPlaybackStartMsRef: { current: number | null }
): number {
  const playback = round.playback;
  const maxStep = Math.min(round.shapeCount || 0, svgRowsLen);
  if (round.state === 'PROCESSING') return Math.min(5, maxStep);
  let displayedStep: number;
  if (playback.playing) {
    const hasAnchor =
      playback.anchorAt != null &&
      typeof (playback.anchorAt as any).toMillis === 'function';
    let anchorMs: number;
    if (hasAnchor) {
      anchorMs = (playback.anchorAt as any).toMillis();
    } else if (clientPlaybackStartMsRef.current != null) {
      anchorMs = clientPlaybackStartMsRef.current;
    } else {
      clientPlaybackStartMsRef.current = now;
      anchorMs = now;
    }
    const elapsed = Math.max(0, now - anchorMs);
    const rate = playback.rate || 0;
    displayedStep = Math.floor(playback.anchorStep + (elapsed * rate) / 1000);
  } else {
    displayedStep = playback.anchorStep || 0;
  }
  return Math.max(0, Math.min(displayedStep, maxStep));
}

const TurnPlayback: React.FC<TurnPlaybackProps> = ({
  code,
  round,
  currentUid,
  currentUserName,
  isJudge,
  judgeName,
  players,
}) => {
  const { rows: svgRows, width: imgWidth, height: imgHeight } = useRoundShapes(round);
  const [displayedStep, setDisplayedStep] = useState<number>(0);
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [landscape, setLandscape] = useState<boolean>(false);
  const [readyUids, setReadyUids] = useState<string[]>([]);
  const [startAnyway, setStartAnyway] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const controlPending = useRef(false);
  const [controlError, setControlError] = useState('');

  const [writing, setWriting] = useState(false);
  const [allGuessed, setAllGuessed] = useState(false);
  const handleWritingChange = useCallback((active: boolean) => setWriting(active), []);
  const handleAllGuessedChange = useCallback((all: boolean) => setAllGuessed(all), []);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const svgWrapRef = useRef<HTMLDivElement | null>(null);
  const clientPlaybackStartMsRef = useRef<number | null>(null);
  const lastPlaybackPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const WIDE_THRESHOLD = 900;
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isWide = w >= WIDE_THRESHOLD;
      const isHoriz = w > h;
      const forceDesktop = w >= 1200;
      setLandscape(Boolean(isWide && (isHoriz || forceDesktop)));
    };
    update();
    let raf = 0;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const roundId = round.id ?? `round-${round.roundIndex}`;
  const modifier = round.imageModifier || NO_IMAGE_MODIFIER;
  const shuffleSeed = modifier.type === 'shuffle' ? modifier.seed : undefined;
  const revealOrder = useMemo(() => shuffleSeed === undefined ? undefined : seededShapeOrder(svgRows.length, shuffleSeed), [svgRows.length, shuffleSeed]);
  const fullPreview = isJudge && round.state === 'PROCESSING';

  const previewCount = Math.min(5, Math.max(0, round.shapeCount || 0));
  const requiredPreviewCount = fullPreview ? round.shapeCount : previewCount;
  const previewIsReady = round.state === 'PROCESSING' &&
    requiredPreviewCount > 0 && svgRows.length >= requiredPreviewCount;

  useEffect(() => {
    if (!isJudge || round.state !== 'PROCESSING') return;
    const counterRef = doc(db, `rooms/${code}/rounds/${roundId}/_counter/meta`);
    return watchDocument(counterRef, (snapshot) => {
      const ready = snapshot.data()?.previewReadyUids;
      setReadyUids(Array.isArray(ready) ? ready : []);
    }, (error) => console.error('Preview readiness subscription failed:', error));
  }, [code, roundId, round.imageRef, round.state, isJudge]);

  useEffect(() => {
    if (!previewIsReady || !currentUid) return;
    let firstFrame = 0;
    let secondFrame = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;
    let acknowledged = false;
    let cancelled = false;
    const acknowledge = () => {
      if (cancelled || document.visibilityState === 'hidden' || pending || acknowledged) return;
      pending = true;
      firstFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        secondFrame = requestAnimationFrame(() => {
          if (cancelled) return;
          const svg = svgWrapRef.current?.querySelector('svg');
          if (!svg || svg.children.length < requiredPreviewCount) {
            pending = false;
            retryTimer = setTimeout(acknowledge, 1000);
            return;
          }
          pending = true;
          updateDoc(doc(db, `rooms/${code}/rounds/${roundId}/_counter/meta`), {
            previewReadyUids: arrayUnion(currentUid),
          }).then(() => {
            acknowledged = true;
          }).catch((error) => {
            pending = false;
            if (cancelled) return;
            console.error('Preview readiness write failed:', error);
            retryTimer = setTimeout(acknowledge, 3000);
          });
        });
      });
    };
    acknowledge();
    document.addEventListener('visibilitychange', acknowledge);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acknowledge);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [previewIsReady, requiredPreviewCount, code, roundId, currentUid, round.imageRef]);

  const allPlayersReady = players.every((player) => readyUids.includes(player.uid));
  const canStart = previewIsReady && (allPlayersReady || startAnyway);

  useEffect(() => {
    setReadyUids([]);
    setStartAnyway(false);
  }, [code, roundId]);

  useEffect(() => {
    if (round.playback.playing && !lastPlaybackPlayingRef.current) {
      clientPlaybackStartMsRef.current = Date.now();
    }
    lastPlaybackPlayingRef.current = round.playback.playing;
  }, [round.playback.playing, roundId]);

  useEffect(() => {
    clientPlaybackStartMsRef.current = null;
    lastPlaybackPlayingRef.current = false;
  }, [roundId]);

  useEffect(() => {
    if (writing || round.state !== 'IN_PROGRESS') return;
    const tick = () => setDisplayedStep(computeDisplayedStep(round, Date.now(), svgRows.length, clientPlaybackStartMsRef));
    tick();
    // Playback follows elapsed time, so reducing paint frequency does not
    // change its speed or make it depend on the presenter's frame rate.
    if (!round.playback.playing) return;
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [round, svgRows.length, writing]);

  useEffect(() => {
    const updateCountdown = () => {
      if (round.startedAt) {
        const hasStartedAt =
          typeof (round.startedAt as any).toMillis === 'function';
        if (hasStartedAt) {
          const startedMs = (round.startedAt as any).toMillis();
          const roundEndsAt = startedMs + round.roundTimerSecs * 1000;
          const graceEndsAt = (round.adjudicationStartedAt?.toMillis?.() || roundEndsAt) + round.graceTimerSecs * 1000;
          const now = Date.now();

          if (round.state === 'IN_PROGRESS') {
            const remaining = roundEndsAt - now;
            setCountdownSec(Math.max(0, Math.ceil(remaining / 1000)));
            const total = round.roundTimerSecs * 1000;
            setProgressPct(Math.max(0, Math.min(1, remaining / total)));
          } else if (round.state === 'ADJUDICATION') {
            const remaining = graceEndsAt - now;
            setCountdownSec(Math.max(0, Math.ceil(remaining / 1000)));
            const total = round.graceTimerSecs * 1000;
            setProgressPct(Math.max(0, Math.min(1, remaining / total)));
          } else if (round.state === 'ADJUDICATION_CLOSED') {
            setCountdownSec(0);
            setProgressPct(0);
          }
        }
      }

    };

    updateCountdown();
    intervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [round.state, round.startedAt, round.roundTimerSecs, round.graceTimerSecs, round, svgRows.length]);

  const updateControl = async (patch: Record<string, any>) => {
    if (!isJudge || controlPending.current) return;
    controlPending.current = true; setControlBusy(true); setControlError('');
    try { await updateDoc(doc(db, `rooms/${code}/rounds/${roundId}`), patch); }
    catch (e) { setControlError('No se pudo aplicar la acción. Inténtalo de nuevo.'); }
    finally { controlPending.current = false; setControlBusy(false); }
  };

  const handleTogglePlay = () => {
    if (!['PROCESSING', 'IN_PROGRESS'].includes(round.state) || (round.state === 'PROCESSING' && !canStart)) return;
    const currentStep = computeDisplayedStep(round, Date.now(), svgRows.length, clientPlaybackStartMsRef);
    const patch: Record<string, any> = { playback: {
      playing: round.state === 'PROCESSING' || !round.playback.playing,
      // Pausing preserves the speed so resuming never falls back to 1 shape/s.
      rate: round.playback.rate || Math.max(1, round.shapeCount / (round.roundTimerSecs * .75)),
      anchorStep: currentStep, anchorAt: serverTimestamp(),
    } };
    if (round.state === 'PROCESSING') {
      patch.state = 'IN_PROGRESS';
      patch.startedAt = serverTimestamp();
    }
    updateControl(patch);
  };
  const handleAdvance = (steps: number) => {
    if (round.state !== 'IN_PROGRESS') return;
    const currentStep = computeDisplayedStep(round, Date.now(), svgRows.length, clientPlaybackStartMsRef);
    updateControl({ playback: { ...round.playback, anchorStep: Math.min(round.shapeCount, currentStep + steps), anchorAt: serverTimestamp() } });
  };
  const handleEndGrace = () => {
    if (round.state === 'ADJUDICATION') updateControl({ state: 'ADJUDICATION_CLOSED' });
  };
  const handleStopDrawing = () => {
    if (round.state === 'IN_PROGRESS') updateControl({ state: 'ADJUDICATION', adjudicationStartedAt: serverTimestamp() });
  };
  const handleSkipToScores = () => {
    if (allGuessed && ['IN_PROGRESS', 'ADJUDICATION'].includes(round.state)) {
      updateControl({ state: 'ADJUDICATION_CLOSED' });
    }
  };

  const visibleStep = fullPreview || round.state === 'ADJUDICATION' || round.state === 'ADJUDICATION_CLOSED'
    ? svgRows.length : round.state === 'PROCESSING' ? previewCount : displayedStep;

  const countdownColor =
    round.state === 'IN_PROGRESS' && countdownSec < 10 ? 'danger' : 'primary';

  const canvasWrap = (
    <div
      ref={svgWrapRef}
      style={{
        flex: '0 0 auto',
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        padding: landscape ? '12px 12px 8px 16px' : '8px 8px 4px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: landscape
            ? isJudge
              ? 'min(55vh, 720px)'
              : 'min(80vh, 720px)'
            : isJudge
              ? 'min(34vh, 72vw, 260px)'
              : 'min(94vw, max(64px, calc(var(--room-viewport-height, 100vh) - 300px)), 700px)',
          margin: '0 auto',
          aspectRatio: '1 / 1',
          display: 'block',
          background: 'var(--app-inset)',
          borderRadius: landscape ? '18px' : '16px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(30, 35, 90, 0.08)',
        }}
      >
        {visibleStep > 0 ? (
          <InlineSvgPreview
            shapes={svgRows}
            step={visibleStep}
            width={imgWidth}
            height={imgHeight}
            revealOrder={fullPreview ? undefined : revealOrder}
            filter={imageModifierFilter(modifier)}
          />
        ) : svgRows.length > 0 && round.shapeCount > 0 ? (
          <div
            className="ion-text-center ion-padding"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <IonText color="medium" style={{ fontSize: '12px' }}>
              La imagen empieza a aparecer…
            </IonText>
          </div>
        ) : (
          <div
            className="ion-text-center ion-padding"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <IonText color="medium">Cargando imagen…</IonText>
            {round.imageRef && round.shapeCount > 0 && (
              <IonText color="medium" style={{ fontSize: '11px' }}>
                Preparando la imagen para la partida…
              </IonText>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const progressBar = (
    <div
      style={{
        flex: '0 0 auto',
        padding: '6px 12px',
        background: 'var(--app-inset)',
        width: '100%',
      }}
    >
      {round.state === 'PROCESSING' && (
        <IonText color="medium" style={{ fontSize: '13px', fontWeight: 600 }}>
          {isJudge
            ? 'Inicia el turno cuando el grupo esté listo.'
            : 'El presentador iniciará el turno…'}
        </IonText>
      )}
      {round.state === 'IN_PROGRESS' && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <IonText
              color={countdownColor as any}
              style={{ fontSize: '13px', fontWeight: 600 }}
            >
              {countdownSec}s para adivinar
            </IonText>
            <IonText color="medium" style={{ fontSize: '12px' }}>
              Presenta: {judgeName}
            </IonText>
          </div>
          <IonProgressBar color={countdownColor as any} value={progressPct} />
        </>
      )}
      {round.state === 'ADJUDICATION' && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <IonText color="warning" style={{ fontSize: '13px', fontWeight: 600 }}>
              Revisión de respuestas · {countdownSec}s
            </IonText>
            <IonText color="medium" style={{ fontSize: '12px' }}>
              Presenta: {judgeName}
            </IonText>
          </div>
          <IonProgressBar color="warning" value={progressPct} />
        </>
      )}
      {round.state === 'ADJUDICATION_CLOSED' && (
        <IonText color="medium" style={{ fontSize: '13px' }}>
          Calculando puntuaciones…
        </IonText>
      )}
    </div>
  );

  const judgeRhythmControls = isJudge &&
    (round.state === 'PROCESSING' || round.state === 'IN_PROGRESS') && (
      <JudgeRhythmBar
        playing={round.playback.playing}
        disabled={controlBusy || (round.state === 'PROCESSING' && !canStart)}
        starting={round.state === 'PROCESSING'}
        complete={round.state === 'IN_PROGRESS' && displayedStep >= round.shapeCount}
        onTogglePlay={handleTogglePlay}
        onAdvance={handleAdvance}
      />
    );

  const judgeTransitionControls = isJudge && (
    <div style={{ textAlign: 'center', padding: '4px 12px 10px' }}>
      {round.state === 'IN_PROGRESS' && !allGuessed && <IonButton size="small" fill="clear" disabled={controlBusy} onClick={handleStopDrawing}><IonIcon slot="start" icon={playSkipForward} />Cerrar respuestas y revisar</IonButton>}
      {round.state === 'ADJUDICATION' && !allGuessed && <><p className="game-hint">Valida los aciertos antes de continuar.</p><IonButton size="small" disabled={controlBusy} onClick={handleEndGrace}><IonIcon slot="start" icon={stopCircle} />Confirmar y ver puntos</IonButton></>}
    </div>
  );
  const judgeActionBar = isJudge && <div className="judge-action-bar">
    {allGuessed && ['IN_PROGRESS', 'ADJUDICATION'].includes(round.state) && <div className="judge-complete-notice">
      <div role="status" aria-live="polite"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><div><strong>¡Todos acertaron!</strong><p>Puedes saltar a los puntos o dejar que termine el tiempo.</p></div></div>
      <IonButton color="success" disabled={controlBusy} onClick={handleSkipToScores}><IonIcon slot="start" icon={playSkipForward} />Saltar a los puntos</IonButton>
    </div>}
    {round.state === 'PROCESSING' && <div className="ion-text-center">
      <p className="game-hint" role="status">{players.filter(player => readyUids.includes(player.uid)).length}/{players.length} jugadores listos</p>
      {!allPlayersReady && !startAnyway && <IonButton size="small" fill="clear" onClick={() => setStartAnyway(true)}>Permitir inicio sin esperar a todos</IonButton>}
    </div>}
    {judgeRhythmControls}
    {judgeTransitionControls}
    {controlError && <p role="alert" className="game-error">{controlError}</p>}
  </div>;

  const chatPanelFull = (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
      <GuessChatPanel
        code={code}
        round={round}
        currentUid={currentUid}
        currentUserName={currentUserName}
        isJudge={isJudge}
        players={players}
        viewMode="full"
        onWritingChange={handleWritingChange}
      />
    </div>
  );

  const judgeGroupsOnly = (
    <div
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          padding: '4px 12px',
          background: 'var(--app-warm-bg)',
          borderBottom: '1px solid var(--app-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <IonText style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-warm-text)' }}>
          ⚖️ Valida las respuestas
        </IonText>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <GuessChatPanel
          code={code}
          round={round}
          currentUid={currentUid}
          currentUserName={currentUserName}
          isJudge={isJudge}
          players={players}
          viewMode="groupsOnly"
          onAllGuessedChange={handleAllGuessedChange}
        />
      </div>
    </div>
  );

  const judgeRightCol = (
    <div
      className="turn-playback-chat"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: landscape ? '1 1 52%' : '1 0 160px',
        minWidth: 0,
        minHeight: 0,
        borderLeft: '1px solid var(--app-border)',
        background: 'var(--app-inset)',
      }}
    >
      {judgeGroupsOnly}
    </div>
  );

  const guesserRightCol = (
    <div
      className="turn-playback-chat"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: landscape ? '1 1 50%' : '1 0 160px',
        minWidth: 0,
        minHeight: 0,
        borderLeft: '1px solid var(--app-border)',
        background: 'var(--app-inset)',
      }}
    >
      {chatPanelFull}
    </div>
  );

  const leftCol = (
    <div
      className="turn-playback-art"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: landscape ? (isJudge ? '1 1 48%' : '1 1 50%') : '0 1 auto',
        minWidth: 0,
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      {judgeActionBar}
      {canvasWrap}
      {fullPreview && <p className="game-hint">Vista previa completa · Solo tú puedes verla</p>}
      {progressBar}
    </div>
  );

  return (
    <div
      className="turn-playback"
      style={{
        display: 'flex',
        flexDirection: landscape ? 'row' : 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {leftCol}
      {isJudge ? judgeRightCol : guesserRightCol}
    </div>
  );
};

export default TurnPlayback;
export { TurnPlayback };
