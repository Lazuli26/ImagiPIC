import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase/firebaseApp';
import type { RoundDoc, RoomDoc } from '../types/database';
import { scoreRound } from './roundOperations';

interface UseRoundLifecycleProps {
  code: string;
  round: RoundDoc;
  room: RoomDoc;
  currentUid?: string;
}

export function useRoundLifecycle({
  code,
  round,
  room,
  currentUid,
}: UseRoundLifecycleProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scoreTriedRef = useRef<boolean>(false);

  const roundId = round.id ?? `round-${round.roundIndex}`;

  const timers = useMemo(() => {
    if (!round.startedAt) return null;
    const startedMs = round.startedAt.toMillis();
    const roundEndsAtMs = startedMs + round.roundTimerSecs * 1000;
    const graceEndsAtMs = (round.adjudicationStartedAt?.toMillis?.() || roundEndsAtMs) + round.graceTimerSecs * 1000;
    return { roundEndsAtMs, graceEndsAtMs };
  }, [round.startedAt, round.roundTimerSecs, round.graceTimerSecs, round.adjudicationStartedAt]);

  useEffect(() => {
    scoreTriedRef.current = false;
  }, [roundId, round.state]);

  useEffect(() => {
    if (!timers || !['PLAYING', 'SCOREBOARD'].includes(room.state)) return;

    const tick = () => {
      const now = Date.now();
      const roundRef = doc(db, `rooms/${code}/rounds/${roundId}`);

      if (currentUid === room.hostUid && round.state === 'IN_PROGRESS' && now >= timers.roundEndsAtMs) {
        updateDoc(roundRef, { state: 'ADJUDICATION', adjudicationStartedAt: serverTimestamp() }).catch(() => {});
      }

      if (currentUid === room.hostUid && round.state === 'ADJUDICATION' && now >= timers.graceEndsAtMs) {
        updateDoc(roundRef, { state: 'ADJUDICATION_CLOSED' }).catch(() => {});
      }

      const shouldScore = round.state === 'ADJUDICATION_CLOSED' && round.results == null && !scoreTriedRef.current;

      // Host-only scoring writer: firestore.rules gate cumulativeScores writes
      // to isHost(code). Non-hosts never try to avoid transaction rejections and
      // console-error spam. host tick fires every 500ms like everyone else, so
      // the scoring write still happens promptly — delayed only by at most 500ms
      // worst case (a single missed tick interval).
      const isHostHere = currentUid != null && room.hostUid === currentUid;

      if (shouldScore && isHostHere) {
        scoreTriedRef.current = true;
        scoreRound(code, round.roundIndex, currentUid!).catch(() => {
          scoreTriedRef.current = false;
        });
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timers, round.state, round.results, roundId, code, currentUid, room.hostUid, room.state, round.roundIndex]);
}
