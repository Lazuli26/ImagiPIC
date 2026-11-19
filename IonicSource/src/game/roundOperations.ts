import {
  serverTimestamp,
  runTransaction,
  doc,
  updateDoc,
  Timestamp,
  collection,
  getDocsFromServer,
  getDocFromServer,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import { typedDoc } from '../firebase/firestore';
import type {
  DeckImageDoc,
  GuessDoc,
  RoundDoc,
  RoundCounterDoc,
  RoomDoc,
  PlaybackState,
  ImageModifier,
} from '../types/database';
import { computeScores } from './scoring';
import { isLastTurn } from './match';
import { getNextJudgeUid } from './roomOperations';
import { NO_IMAGE_MODIFIER } from './imageModifiers';
import { normalizeAndFlattenShapes } from '../utils/compactShapeCodec';

export async function selectRoundImage(
  code: string,
  roundIndex: number,
  judgeUid: string,
  deckImage: DeckImageDoc,
  imageModifier: ImageModifier = NO_IMAGE_MODIFIER
): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);
  const roundId = `round-${roundIndex}`;
  const roundRef = doc(db, `rooms/${code}/rounds/${roundId}`);
  const counterRef = doc(db, `rooms/${code}/rounds/${roundId}/_counter/meta`);
  const imageRefPath = `user_decks/${deckImage.ownerUid}/images/${deckImage.id}`;

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }
    const room = roomSnap.data()!;

    if (room.roundIndex !== roundIndex) {
      throw new Error('Round index mismatch');
    }

    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Round not found');
    }
    const round = roundSnap.data() as RoundDoc;

    if (room.state !== 'PLAYING' || round.state !== 'TURN_START') throw new Error('La imagen ya fue seleccionada.');

    if (round.judgeUid !== judgeUid) {
      throw new Error('Only the judge can select the image');
    }

    const nowClient = Timestamp.now();
    const totalShapes = Math.max(1, deckImage.shapeCount || 0);
    const renderSecs = Math.max(2, Math.floor(room.roundTimerSecs * 0.75));
    const playbackRate = Number((totalShapes / renderSecs).toFixed(3));
    const initialStep = Math.min(5, Math.max(0, deckImage.shapeCount || 0));

    // Paused start: the round stays in PROCESSING with the first few shapes
    // visible and playback stopped. `startedAt` is NOT stamped here, so the
    // round timer stays idle until the judge's first action (play/advance)
    // transitions the round to IN_PROGRESS. This grace period lets every
    // client load the shapes before the turn begins.
    const processingRound: Partial<RoundDoc> = {
      imageRef: imageRefPath,
      imageModifier,
      width: deckImage.width,
      height: deckImage.height,
      shapeCount: deckImage.shapeCount,
      shapesCompactCopy: normalizeAndFlattenShapes(deckImage.shapesCompact),
      playback: {
        playing: false,
        rate: playbackRate,
        anchorStep: initialStep,
        anchorAt: nowClient,
      },
      roundTimerSecs: room.roundTimerSecs,
      graceTimerSecs: room.graceTimerSecs,
      state: 'PROCESSING',
      // Selection may take longer than the turn itself. No creation-time
      // timestamp may be interpreted as the start of the guessing timer.
      startedAt: null as any,
      guessesCount: 0,
      unjudgedCount: 0,
    };
    transaction.update(roundRef, processingRound);

    const counterDoc: RoundCounterDoc = {
      roundId,
      lastGuessAtMs: {},
      perUidGuessCount: {},
    };
    transaction.set(counterRef, counterDoc);
  });
}

export async function writePlayback(
  code: string,
  roundIndex: number,
  patch: Partial<PlaybackState>,
  _judgeUid?: string
): Promise<void> {
  const roundId = `round-${roundIndex}`;
  const roundRef = doc(db, `rooms/${code}/rounds/${roundId}`);
  await updateDoc(roundRef, {
    playback: {
      ...patch,
    },
  } as any);
}

export async function advanceRound(
  code: string,
  nextRoundIndex: number,
  nextJudgeUid: string
): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);
  const roundId = `round-${nextRoundIndex}`;
  const roundRef = doc(db, `rooms/${code}/rounds/${roundId}`);
  const counterRef = doc(db, `rooms/${code}/rounds/${roundId}/_counter/meta`);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }
    const room = roomSnap.data()!;

    const currentRoundIndex = room.roundIndex;
    // Race-safe no-op: some other client already advanced to this round index
    // (or beyond). Do nothing and resolve cleanly instead of a 403 log spam.
    if (nextRoundIndex <= currentRoundIndex) {
      return;
    }

    if (room.state !== 'PLAYING' && room.state !== 'SCOREBOARD') return;
    if (nextRoundIndex !== currentRoundIndex + 1) throw new Error('El siguiente turno no es válido.');
    const currentRoundSnap = await transaction.get(doc(db, `rooms/${code}/rounds/round-${currentRoundIndex}`));
    if (!currentRoundSnap.exists() || !['SCORED', 'SCOREBOARD'].includes(currentRoundSnap.data().state)) {
      throw new Error('El turno todavía no ha terminado.');
    }
    if (isLastTurn(room) || room.players.length < 2 || !room.players.some(p => !p.skipJudge)) {
      transaction.update(roomRef, { state: 'ENDED', endedAt: serverTimestamp() });
      return;
    }
    const skip: Record<string, boolean> = {};
    room.players.forEach(p => { skip[p.uid] = p.skipJudge; });
    nextJudgeUid = getNextJudgeUid(room.turnOrder, nextRoundIndex - (room.gameStartRoundIndex || 0), skip);

    // Guard against duplicate round document creation (e.g. another client's
    // racing transaction created this round between our get and commit).
    const existingRoundSnap = await transaction.get(roundRef);
    if (existingRoundSnap.exists()) {
      return;
    }

    transaction.update(roomRef, {
      roundIndex: nextRoundIndex,
    });

    const nowClient = Timestamp.now();

    const roundDoc: RoundDoc = {
      id: roundId,
      roundIndex: nextRoundIndex,
      judgeUid: nextJudgeUid,
      imageRef: '',
      width: 0,
      height: 0,
      shapeCount: 0,
      playback: {
        playing: false,
        rate: 0,
        anchorStep: 0,
        anchorAt: nowClient,
      },
      startedAt: serverTimestamp() as any,
      roundTimerSecs: room.roundTimerSecs,
      graceTimerSecs: room.graceTimerSecs,
      state: 'TURN_START',
      guessesCount: 0,
      unjudgedCount: 0,
      results: null as any,
    };
    transaction.set(roundRef, roundDoc);

    const counterDoc: RoundCounterDoc = {
      roundId,
      lastGuessAtMs: {},
      perUidGuessCount: {},
    };
    transaction.set(counterRef, counterDoc);
  });
}

/** Read the frozen answers after review closes, then commit scores exactly once. */
export async function scoreRound(code: string, roundIndex: number, hostUid: string): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);
  const roundRef = doc(db, `rooms/${code}/rounds/round-${roundIndex}`);
  // A round listener can arrive before the guesses listener. Read from the
  // server so the last verdict is included even when the host's UI is stale.
  const answerSnapshot = await getDocsFromServer(collection(db, `rooms/${code}/rounds/round-${roundIndex}/guesses`));
  const answers = answerSnapshot.docs.map(snapshot => snapshot.data() as GuessDoc);
  try {
    await runTransaction(db, async transaction => {
      const roundSnapshot = await transaction.get(roundRef);
      const roomSnapshot = await transaction.get(roomRef);
      if (!roundSnapshot.exists() || !roomSnapshot.exists()) return;
      const round = roundSnapshot.data() as RoundDoc;
      const room = roomSnapshot.data()!;
      if (room.hostUid !== hostUid || !['PLAYING', 'SCOREBOARD'].includes(room.state) || room.roundIndex !== roundIndex) return;
      if (round.state !== 'ADJUDICATION_CLOSED' || round.results != null) return;
      const scores = computeScores(round, answers, room.players.map(player => player.uid));
      const cumulativeScores = { ...(room.cumulativeScores || {}) };
      Object.entries(scores.perPlayerScores).forEach(([uid, points]) => { cumulativeScores[uid] = (cumulativeScores[uid] || 0) + points; });
      transaction.update(roundRef, { results: { perPlayerScores: scores.perPlayerScores, rankOrder: scores.rankOrder,
        scoringVersion: 2, breakdown: scores.breakdown, guesserCount: scores.meta.guesserCount }, state: 'SCORED', scoredAt: serverTimestamp() });
      transaction.update(roomRef, { cumulativeScores });
    });
  } catch (error) {
    // Another host tab may have committed while this transaction was retrying.
    // Treat an already-scored round as success, preserving its single award.
    const latest = await getDocFromServer(roundRef);
    if (latest.exists() && latest.data().results != null && ['SCORED', 'SCOREBOARD'].includes(latest.data().state)) return;
    throw error;
  }
}

