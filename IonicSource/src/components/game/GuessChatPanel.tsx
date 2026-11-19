import {
  IonButton,
  IonContent,
  IonIcon,
  IonAvatar,
  IonText,
  IonBadge,
  IonCard,
  IonCardContent,
  IonToast,
} from '@ionic/react';
import { close } from 'ionicons/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  writeBatch,
  serverTimestamp,
  runTransaction,
  collection,
  doc,
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseApp';
import { useGuesses } from '../../game/useGuesses';
import type { GuessDoc, RoundDoc, RoomPlayer, Verdict, CorrectStars } from '../../types/database';

import { correctStars, MAX_SPEED_BONUS, STAR_BASE_POINTS, STAR_DESCRIPTIONS } from '../../game/scoring';

type GuessPanelViewMode = 'full' | 'groupsOnly';

interface GuessChatPanelProps {
  code: string;
  round: RoundDoc;
  currentUid: string;
  currentUserName: string;
  isJudge: boolean;
  players: RoomPlayer[];
  viewMode?: GuessPanelViewMode;
  onWritingChange?: (writing: boolean) => void;
  onAllGuessedChange?: (all: boolean) => void;
}

interface GuessGroup {
  textNormalized: string;
  textDisplay: string;
  count: number;
  guesses: GuessDoc[];
  verdict: Verdict;
  stars: CorrectStars | null;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const GuessChatPanel: React.FC<GuessChatPanelProps> = ({
  code,
  round,
  currentUid,
  currentUserName,
  isJudge,
  players,
  viewMode = 'full',
  onWritingChange,
  onAllGuessedChange,
}) => {
  const roundId = round.id ?? `round-${round.roundIndex}`;
  const { guesses } = useGuesses(code, roundId);

  const [inputValue, setInputValue] = useState<string>('');
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);
  const [writing, setWriting] = useState(false);
  const writingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const pendingVerdicts = useRef(new Set<string>());
  const verdictRetryAt = useRef(0);

  const stopWriting = () => {
    if (writingTimer.current) clearTimeout(writingTimer.current);
    setWriting(false);
    onWritingChange?.(false);
  };
  const noteWriting = () => {
    if (writingTimer.current) clearTimeout(writingTimer.current);
    setWriting(true);
    onWritingChange?.(true);
    writingTimer.current = setTimeout(stopWriting, 1500);
  };
  useEffect(() => () => {
    if (writingTimer.current) clearTimeout(writingTimer.current);
    onWritingChange?.(false);
  }, [onWritingChange]);
  useEffect(() => {
    const guessers = players.filter(player => player.uid !== round.judgeUid);
    onAllGuessedChange?.(guessers.length > 0 && guessers.every(player =>
      guesses.some(guess => guess.uid === player.uid && guess.verdict === 'CORRECT')));
  }, [players, guesses, round.judgeUid, onAllGuessedChange]);
  const contentRef = useRef<HTMLIonContentElement | null>(null);

  const guessCount = useMemo(
    () => guesses.filter((g) => g.uid === currentUid).length,
    [guesses, currentUid]
  );

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollToBottom(200);
    }
  }, [guesses.length]);

  const alreadyCorrect = guesses.some(g => g.uid === currentUid && g.verdict === 'CORRECT');
  useEffect(() => {
    if (round.state !== 'IN_PROGRESS' || alreadyCorrect) {
      if (writingTimer.current) clearTimeout(writingTimer.current);
      setWriting(false);
      onWritingChange?.(false);
    }
  }, [round.state, alreadyCorrect, onWritingChange]);
  const retryWaitMs = Math.max(0, 2000 - (nowTick - lastSubmittedAt));
  const canSubmit =
    !isJudge &&
    !alreadyCorrect &&
    round.state === 'IN_PROGRESS' &&
    retryWaitMs === 0 &&
    guessCount < 50 &&
    !submitting;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return;
    // Read the native buffer, including the keyboard's latest autocorrection.
    const textRaw = (inputRef.current?.value ?? inputValue).trim().slice(0, 120);
    if (!textRaw) return;
    const textNormalized = textRaw.toLowerCase().replace(/\s+/g, ' ');
    if (!textNormalized) return;

    if (Date.now() - lastSubmittedAt < 2000) {
      showToast(`Espera ${((2000 - (Date.now() - lastSubmittedAt)) / 1000).toFixed(1)}s para enviar otra respuesta`);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const guessesCollRef = collection(db, `rooms/${code}/rounds/${roundId}/guesses`);
    const counterRef = doc(db, `rooms/${code}/rounds/${roundId}/_counter/meta`);

    try {
      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const counterData = counterSnap.exists()
          ? counterSnap.data()
          : { lastGuessAtMs: {}, perUidGuessCount: {} };
        const lastAt = (counterData.lastGuessAtMs || {})[currentUid] || 0;
        const now = Date.now();
        if (lastAt !== 0 && now - lastAt < 2000) {
          throw new Error('Rate limited');
        }
        const countNow = (counterData.perUidGuessCount || {})[currentUid] || 0;
        if (countNow >= 50) {
          throw new Error('Guess limit reached');
        }

        const newGuessRef = doc(guessesCollRef);
        const guessData: Omit<GuessDoc, 'id'> = {
          uid: currentUid,
          displayName: currentUserName,
          textRaw,
          textNormalized,
          submittedAt: serverTimestamp() as any,
          verdict: null,
          stars: null,
          verdictAt: null,
          verdictBy: null,
        };
        transaction.set(newGuessRef, { id: newGuessRef.id, ...guessData });

        transaction.set(
          counterRef,
          {
            lastGuessAtMs: {
              ...(counterData.lastGuessAtMs || {}),
              [currentUid]: now,
            },
            perUidGuessCount: {
              ...(counterData.perUidGuessCount || {}),
              [currentUid]: countNow + 1,
            },
          },
          { merge: true }
        );
      });

      if (inputRef.current) inputRef.current.value = '';
      setInputValue('');
      stopWriting();
      setLastSubmittedAt(Date.now());
    } catch (err: any) {
      const msg = (err && err.message) ? err.message : 'No se pudo enviar la respuesta';
      showToast(msg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const groups = useMemo<GuessGroup[]>(() => {
    if (!isJudge) return [];
    const map = new Map<string, GuessGroup>();
    for (const g of guesses) {
      const existing = map.get(g.textNormalized);
      if (existing) {
        existing.count += 1;
        existing.guesses.push(g);

      } else {
        map.set(g.textNormalized, {
          textNormalized: g.textNormalized,
          textDisplay: g.textRaw,
          count: 1,
          guesses: [g],
          verdict: g.verdict,
          stars: correctStars(g),
        });
      }
    }
    return Array.from(map.values()).map(group => {
      const verdicts = new Set(group.guesses.map(guess => guess.verdict).filter(verdict => verdict !== null));
      group.verdict = verdicts.size === 1 ? group.guesses.find(guess => guess.verdict !== null)!.verdict : null;
      const levels = new Set(group.guesses.filter(guess => guess.verdict === 'CORRECT').map(correctStars));
      group.stars = group.verdict === 'CORRECT' && levels.size === 1 ? Array.from(levels)[0] : null;
      return group;
    }).sort((a, b) => {
      if (a.verdict === null && b.verdict !== null) return -1;
      if (a.verdict !== null && b.verdict === null) return 1;
      const aTime = Math.min(...a.guesses.map((g) => g.submittedAt?.toMillis?.() || 0));
      const bTime = Math.min(...b.guesses.map((g) => g.submittedAt?.toMillis?.() || 0));
      return aTime - bTime;
    });
  }, [guesses, isJudge]);

  const writeVerdicts = async (answers: GuessDoc[], verdict: Verdict, stars: CorrectStars | null = null) => {
    // A room can contain up to 600 attempts; stay below Firestore's batch limit.
    for (let start = 0; start < answers.length; start += 450) {
      const batch = writeBatch(db);
      for (const guess of answers.slice(start, start + 450)) {
        batch.update(doc(db, `rooms/${code}/rounds/${roundId}/guesses/${guess.id}`), {
          verdict,
          stars: verdict === 'CORRECT' ? stars || 3 : null,
          verdictAt: verdict === null ? null : serverTimestamp(),
          verdictBy: verdict === null ? null : currentUid,
        });
      }
      await batch.commit();
    }
  };

  // New attempts inherit the presenter's existing decision for that exact
  // normalized phrase, even if they arrived after the original batch.
  useEffect(() => {
    if (!isJudge || !['IN_PROGRESS', 'ADJUDICATION'].includes(round.state) || Date.now() < verdictRetryAt.current) return;
    for (const group of groups) {
      const pending = group.guesses.filter(guess => guess.verdict === null);
      if (group.verdict === null || (group.verdict === 'CORRECT' && group.stars === null) || !pending.length || pendingVerdicts.current.has(group.textNormalized)) continue;
      pendingVerdicts.current.add(group.textNormalized);
      writeVerdicts(pending, group.verdict, group.stars).catch(error => {
        console.error('Repeated answer verdict failed:', error);
        verdictRetryAt.current = Date.now() + 3000;
      }).finally(() => pendingVerdicts.current.delete(group.textNormalized));
    }
    // nowTick also retries transient failures without requiring another answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, isJudge, round.state, code, roundId, currentUid, nowTick]);

  const applyGroupVerdict = async (group: GuessGroup, verdict: Verdict, stars: CorrectStars | null = null) => {
    if (!isJudge || !['IN_PROGRESS', 'ADJUDICATION'].includes(round.state) || pendingVerdicts.current.has(group.textNormalized)) return;
    pendingVerdicts.current.add(group.textNormalized);
    try {
      await writeVerdicts(group.guesses, verdict, stars);
    } catch (error) {
      console.error('Verdict batch failed:', error);
      showToast('No se pudo guardar la valoración');
    } finally {
      pendingVerdicts.current.delete(group.textNormalized);
    }
  };

  const playerByUid = useMemo(() => {
    const m = new Map<string, RoomPlayer>();
    for (const p of players) m.set(p.uid, p);
    return m;
  }, [players]);

  const showChat = viewMode === 'full' && !isJudge;
  const showGroups = viewMode === 'groupsOnly' || (viewMode === 'full' && isJudge);
  const showInput = viewMode === 'full' && !isJudge;

  const scrollStyle: React.CSSProperties = {
    flex: '1 1 auto',
    minHeight: 0,
    width: '100%',
  };

  const chatListView = (
    <IonContent ref={contentRef} style={scrollStyle} scrollY={true}>
      <div style={{ padding: '8px 12px' }}>
        {guesses.length === 0 ? (
          <div className="ion-text-center ion-padding">
            <IonText color="medium">
              {isJudge ? 'Todavía no hay respuestas.' : '¡Observa la imagen y envía tu primera respuesta!'}
            </IonText>
          </div>
        ) : (
          guesses.map((g) => {
            const isOwn = g.uid === currentUid;
            const verdictRevealed = g.verdict !== null;
            const p = playerByUid.get(g.uid);

            let textVisible: boolean;
            let playerRevealed: boolean;
            if (isJudge) {
              textVisible = true;
              playerRevealed = verdictRevealed;
            } else {
              const hideAnswer = g.verdict === 'CORRECT' && (round.state === 'IN_PROGRESS' || round.state === 'PROCESSING');
              textVisible = isOwn || (verdictRevealed && !hideAnswer);
              playerRevealed = !isOwn && verdictRevealed;
            }

            const avatarLetter =
              (playerRevealed
                ? (p?.displayName?.[0] || g.displayName?.[0] || '?')
                : isOwn
                  ? (p?.displayName?.[0] || g.displayName?.[0] || '?')
                  : '?').toUpperCase();
            const avatarColor = isOwn ? 'var(--app-accent)' : 'var(--app-muted)';

            const bubbleBg = isOwn
              ? 'var(--app-accent)'
              : isJudge
                ? verdictRevealed
                  ? g.verdict === 'CORRECT'
                    ? 'var(--app-success-bg)'
                    : g.verdict === 'WRONG'
                      ? 'var(--app-error-bg)'
                      : 'var(--app-inset)'
                  : 'var(--app-inset)'
                : 'var(--app-inset)';
            const bubbleFg = isOwn ? 'var(--ion-color-primary-contrast)' : 'var(--app-text)';

            return (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  marginBottom: '10px',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                }}
              >
                <IonAvatar
                  style={{
                    width: '32px',
                    height: '32px',
                    flex: '0 0 auto',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: avatarColor,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {avatarLetter}
                  </div>
                </IonAvatar>
                <div
                  style={{
                    maxWidth: isJudge ? '85%' : '75%',
                    background: bubbleBg,
                    color: bubbleFg,
                    borderRadius: '12px',
                    padding: '6px 12px',
                    minWidth: '60px',
                  }}
                >
                  {!textVisible ? (
                    <IonText
                      style={{
                        fontSize: '14px',
                        fontStyle: 'italic',
                        color: isOwn ? 'var(--ion-color-primary-contrast)' : 'var(--app-muted)',
                      }}
                    >
                      {g.verdict === 'CORRECT' ? `${p?.displayName || g.displayName} acertó 🎉` : '[Respuesta enviada]'}
                    </IonText>
                  ) : (
                    <>
                      <IonText
                        style={{
                          fontSize: '14px',
                          wordBreak: 'break-word',
                        }}
                      >
                        <bdi dir="auto">{g.textRaw}</bdi>
                      </IonText>
                      {playerRevealed && !isOwn && (
                        <div
                          style={{
                            fontSize: '10px',
                            opacity: 0.8,
                            marginTop: '2px',
                          }}
                        >
                          {p?.displayName || g.displayName}
                        </div>
                      )}
                    </>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      marginTop: '2px',
                      justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {isOwn && g.verdict === null && (
                      <IonBadge color="medium" style={{ fontSize: '9px' }}>
                        Enviada…
                      </IonBadge>
                    )}
                    {g.verdict === 'WRONG' && (
                      <IonBadge color="danger" style={{ fontSize: '9px' }}>
                        INCORRECTA
                      </IonBadge>
                    )}
                    {g.verdict === 'CORRECT' && (
                      <IonBadge color="success" style={{ fontSize: '9px' }}>
                        ACIERTO {'★'.repeat(correctStars(g) || 3)}
                      </IonBadge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </IonContent>
  );

  const groupsListView = (
    <IonContent style={scrollStyle} scrollY={true}>
      <div style={{ padding: '6px 10px' }}>
        <div className="judge-guess-progress" aria-label="Progreso de aciertos">
          <strong>{players.filter(player => player.uid !== round.judgeUid && guesses.some(guess => guess.uid === player.uid && guess.verdict === 'CORRECT')).length} / {players.filter(player => player.uid !== round.judgeUid).length} acertaron</strong>
          <div>{players.filter(player => player.uid !== round.judgeUid).map(player => {
            const correct = guesses.some(guess => guess.uid === player.uid && guess.verdict === 'CORRECT');
            return <span key={player.uid} className={correct ? 'is-correct' : ''}>{correct ? '✓' : '○'} {player.displayName}<span className="sr-only">{correct ? ': acertó' : ': aún no acierta'}</span></span>;
          })}</div>
        </div>
        <div style={{ marginBottom: '6px' }}>
          <IonText color="medium" style={{ fontSize: '11px' }}>
            1★: {STAR_BASE_POINTS[1]} · 2★: {STAR_BASE_POINTS[2]} · 3★: {STAR_BASE_POINTS[3]} puntos + hasta {MAX_SPEED_BONUS} por rapidez. Puedes cambiar las estrellas hasta cerrar la revisión.
            <br />
            {groups.length} respuestas distintas
            {' · '}
            {guesses.filter((g) => g.verdict === null).length} pendientes
          </IonText>
        </div>
        {groups.length === 0 ? (
          <div className="ion-text-center ion-padding">
            <IonText color="medium">Aquí aparecerán las respuestas para validarlas.</IonText>
          </div>
        ) : (
          groups.map((group) => {
            const isCorrect = group.verdict === 'CORRECT';
            const isWrong = group.verdict === 'WRONG';
            const buttonsDisabled =
              round.state !== 'IN_PROGRESS' && round.state !== 'ADJUDICATION';
            return (
              <IonCard key={group.textNormalized} style={{ margin: '4px 0' }}>
                <IonCardContent style={{ padding: '4px 8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flex: '1 1 auto',
                        minWidth: 0,
                      }}
                    >
                      <IonBadge color="medium" style={{ flex: '0 0 auto', fontSize: '10px' }}>
                        ×{group.count}
                      </IonBadge>
                      <IonText
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          overflowWrap: 'anywhere',
                          minWidth: 0,
                        }}
                      >
                        {capitalizeFirst(group.textDisplay)}
                      </IonText>
                      {isCorrect && <IonBadge color="success">{group.stars ? '★'.repeat(group.stars) : 'Mixto'}</IonBadge>}
                      {isWrong && <IonBadge color="danger">✗</IonBadge>}
                    </div>
                    <div className="guess-verdict-actions">
                      <IonButton
                        size="small"
                        color="danger"
                        fill={isWrong ? 'solid' : 'outline'}
                        disabled={buttonsDisabled}
                        onClick={() => applyGroupVerdict(group, 'WRONG')}
                        aria-label={`Marcar ${group.textDisplay} como incorrecta`}
                        style={{ minWidth: '40px', minHeight: '40px', margin: 0 }}
                      >
                        <IonIcon slot="start" icon={close} />No
                      </IonButton>
                      {([1, 2, 3] as CorrectStars[]).map(stars => <IonButton
                        key={stars}
                        size="small"
                        color="success"
                        fill={isCorrect && group.stars === stars ? 'solid' : 'outline'}
                        disabled={buttonsDisabled}
                        onClick={() => applyGroupVerdict(group, 'CORRECT', stars)}
                        aria-label={`Dar ${stars} ${stars === 1 ? 'estrella' : 'estrellas'} a ${group.textDisplay}`}
                        aria-pressed={isCorrect && group.stars === stars}
                        title={`${STAR_DESCRIPTIONS[stars]} · ${STAR_BASE_POINTS[stars]} puntos + hasta ${MAX_SPEED_BONUS} por rapidez`}
                      >{'★'.repeat(stars)}</IonButton>)}
                      <IonButton size="small" fill="clear" color="medium" disabled={buttonsDisabled || group.verdict === null}
                        onClick={() => applyGroupVerdict(group, null)} aria-label={`Dejar ${group.textDisplay} pendiente`}>Deshacer</IonButton>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            );
          })
        )}
      </div>
    </IonContent>
  );

  const inputBarView = showInput && (
    <div
      className="guess-composer"
      style={{
        flex: '0 0 auto',
        padding: '8px 16px',
        borderTop: '1px solid var(--app-border)',
        background: 'var(--app-surface)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {round.state !== 'IN_PROGRESS' ? (
        <div className="ion-text-center" style={{ padding: '8px' }}>
          <IonText color="medium" style={{ fontSize: '13px' }}>
            {round.state === 'PROCESSING'
              ? 'El presentador iniciará el turno…'
              : round.state === 'ADJUDICATION'
                ? 'Se cerraron las respuestas. El presentador está revisando…'
                : round.state === 'ADJUDICATION_CLOSED'
                  ? 'Calculando las puntuaciones…'
                  : 'Las respuestas no están disponibles'}
          </IonText>
        </div>
      ) : alreadyCorrect ? (<div className="ion-text-center" role="status" style={{ padding: '12px', color: 'var(--app-success)', fontWeight: 700 }}>¡Acertaste! Espera a los demás para ver los puntos.</div>) : guessCount >= 50 ? (
        <div className="ion-text-center" style={{ padding: '8px' }}>
          <IonText color="warning" style={{ fontSize: '13px' }}>
            Has usado las 50 respuestas de este turno
          </IonText>
        </div>
      ) : (
        <div>
        {writing && <div className="writing-notice" role="status">
          <span>Imagen pausada mientras escribes. El tiempo sigue corriendo.</span>
          <IonButton size="small" fill="clear" onClick={() => { if (inputRef.current) inputRef.current.value = ''; setInputValue(''); stopWriting(); inputRef.current?.blur(); }}>Descartar mensaje</IonButton>
        </div>}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '0 4px' }}>
          <div
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              background: 'var(--app-surface)',
              color: 'var(--app-text)',
              borderRadius: '12px',
              border: '1px solid var(--app-border)',
              padding: '0 12px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <input
              ref={inputRef}
              aria-label="Tu respuesta"
              dir="ltr"
              {...{ enterKeyHint: 'send' }}
              maxLength={120}
              // Let Android/iOS own the value and caret during composition.
              // Playback/timer renders must never rewrite the keyboard buffer.
              defaultValue=""
              placeholder={
                retryWaitMs > 0
                  ? `Puedes escribir; envía en ${Math.ceil(retryWaitMs / 1000)}s`
                  : '¿Qué aparece en la imagen?'
              }
              disabled={submitting}
              onChange={event => { setInputValue(event.target.value); noteWriting(); }}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={event => { composingRef.current = false; setInputValue(event.currentTarget.value); noteWriting(); }}
              onFocus={noteWriting}
              onBlur={stopWriting}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && !composingRef.current && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              style={{
                width: '100%',
                color: 'var(--app-text)',
                background: 'transparent', border: 0, outlineOffset: '4px', minHeight: '40px', minWidth: 0,
                fontSize: '16px', textAlign: 'start',
              }}
            />
          </div>
          <IonButton
            color="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || !inputValue.trim()}
          >
            Enviar
          </IonButton>
        </div>
        </div>
      )}
    </div>
  );

  const toastView = (
    <IonToast
      isOpen={toastOpen}
      message={toastMsg}
      duration={1500}
      onDidDismiss={() => setToastOpen(false)}
    />
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {showChat && chatListView}
        {showGroups && groupsListView}
        {inputBarView}
      </div>
      {toastView}
    </>
  );
};

export default React.memo(GuessChatPanel);
export { GuessChatPanel };
