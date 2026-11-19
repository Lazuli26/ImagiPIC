import {
  serverTimestamp,
  setDoc,
  runTransaction,
  doc,
  Timestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import { typedColl, typedDoc } from '../firebase/firestore';
import { generateUniqueRoomCode } from '../utils/roomCode';
import { eligibleJudges, DEFAULT_ROUNDS_PER_GAME } from './match';
import { shuffle } from '../utils/shuffle';
import type { RoomDoc, RoomPlayer, RoundDoc, RoundCounterDoc } from '../types/database';

export function getNextJudgeUid(
  turnOrder: string[],
  roundIndex: number,
  playersSkipJudge: Record<string, boolean>
): string {
  const eligible = turnOrder.filter(uid => playersSkipJudge[uid] === false);
  if (!eligible.length) throw new Error('Al menos una persona debe presentar imágenes.');
  return eligible[roundIndex % eligible.length];
}

export async function createRoom(hostUser: {
  uid: string;
  displayName: string;
  photoURL: string;
}): Promise<string> {
  const roomsColl = typedColl<RoomDoc>('rooms');
  const code = await generateUniqueRoomCode(roomsColl);

  const roomDoc: RoomDoc = {
    code,
    hostUid: hostUser.uid,
    state: 'LOBBY',
    players: [
      {
        uid: hostUser.uid,
        displayName: hostUser.displayName,
        photoURL: hostUser.photoURL,
        isHost: true,
        skipJudge: false,
        connectedAt: Timestamp.now(),
      },
    ],
    turnOrder: [hostUser.uid],
    roundIndex: 0,
    maxPlayers: 12,
    roundsPerGame: DEFAULT_ROUNDS_PER_GAME,
    scoreboardTimerSecs: 10,
    roundTimerSecs: 60,
    graceTimerSecs: 20,
    createdAt: serverTimestamp() as any,
    cumulativeScores: { [hostUser.uid]: 0 },
  };

  const roomRef = doc(db, 'rooms', code);
  await setDoc(roomRef, roomDoc);

  return code;
}

export async function joinRoom(
  code: string,
  user: { uid: string; displayName: string; photoURL: string }
): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('No se encontró la sala.');
    }

    const room = roomSnap.data()!;

    if (room.players.some(p => p.uid === user.uid)) return;
    if (room.state !== 'LOBBY') throw new Error('La partida ya empezó. Espera a que vuelvan a la sala.');
    if (room.players.length >= room.maxPlayers) throw new Error('La sala está llena.');

    const newPlayer: RoomPlayer = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isHost: false,
      skipJudge: false,
      connectedAt: Timestamp.now(),
    };

    const updatedPlayers = [...room.players, newPlayer];
    const updatedTurnOrder = [...room.turnOrder, user.uid];
    const updatedScores = { ...room.cumulativeScores };
    if (!(user.uid in updatedScores)) {
      updatedScores[user.uid] = 0;
    }

    transaction.update(roomRef, {
      players: updatedPlayers,
      turnOrder: updatedTurnOrder,
      cumulativeScores: updatedScores,
    });
  });
}

export async function leaveRoom(code: string, uid: string): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      return;
    }

    const room = roomSnap.data()!;
    const updatedPlayers = room.players.filter((p) => p.uid !== uid);
    const updatedTurnOrder = room.turnOrder.filter((u) => u !== uid);
    const updatedScores = { ...room.cumulativeScores };
    if (room.state === 'LOBBY') delete updatedScores[uid];

    let newHostUid = room.hostUid;
    if (uid === room.hostUid && updatedPlayers.length > 0) {
      newHostUid = updatedPlayers[0].uid;
      updatedPlayers[0] = { ...updatedPlayers[0], isHost: true };
    }

    const newState: RoomDoc['state'] = updatedPlayers.length === 0 ? 'ENDED' : room.state;

    transaction.update(roomRef, {
      players: updatedPlayers,
      turnOrder: updatedTurnOrder,
      cumulativeScores: updatedScores,
      ...(room.state !== 'LOBBY' && !room.matchPlayers ? { matchPlayers: room.players } : {}),
      hostUid: newHostUid,
      state: newState,
    });
  });
}

export async function kickPlayer(
  code: string,
  hostUid: string,
  targetUid: string
): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('No se encontró la sala.');
    }

    const room = roomSnap.data()!;

    if (room.hostUid !== hostUid) {
      throw new Error('Only host can kick players');
    }

    const updatedPlayers = room.players.filter((p) => p.uid !== targetUid);
    const updatedTurnOrder = room.turnOrder.filter((u) => u !== targetUid);
    const updatedScores = { ...room.cumulativeScores };
    delete updatedScores[targetUid];

    transaction.update(roomRef, {
      players: updatedPlayers,
      turnOrder: updatedTurnOrder,
      cumulativeScores: updatedScores,
    });
  });
}

export async function toggleSkipJudge(
  code: string,
  selfUid: string,
  skip: boolean
): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('No se encontró la sala.');
    }

    const room = roomSnap.data()!;

    if (room.state !== 'LOBBY') throw new Error('Los roles solo se cambian en la sala.');

    const updatedPlayers = room.players.map((p) =>
      p.uid === selfUid ? { ...p, skipJudge: skip } : p
    );

    transaction.update(roomRef, {
      players: updatedPlayers,
    });
  });
}

export async function updateRoomSettings(
  code: string,
  hostUid: string,
  patch: Partial<{ maxPlayers: number; roundTimerSecs: number; graceTimerSecs: number; roundsPerGame: number; scoreboardTimerSecs: number }>
): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('No se encontró la sala.');
    }

    const room = roomSnap.data()!;

    if (room.hostUid !== hostUid) {
      throw new Error('Only host can update settings');
    }

    if (room.state !== 'LOBBY') throw new Error('La configuración solo se cambia antes de empezar.');
    const limits: Record<string, [number, number]> = { maxPlayers: [2, 12], roundTimerSecs: [15, 180], graceTimerSecs: [10, 60], roundsPerGame: [1, 5], scoreboardTimerSecs: [0, 30] };
    Object.entries(patch).forEach(([key, value]) => {
      const [min, max] = limits[key];
      if (!Number.isInteger(value) || value < min || value > max) throw new Error('Configuración no válida.');
    });
    if (patch.maxPlayers != null && patch.maxPlayers < room.players.length) throw new Error('Ya hay más personas en la sala que plazas seleccionadas.');
    transaction.update(roomRef, patch);
  });
}

export async function endGame(code: string, hostUid: string): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('No se encontró la sala.');
    }

    const room = roomSnap.data()!;

    if (room.hostUid !== hostUid) {
      throw new Error('Only host can end the game');
    }

    transaction.update(roomRef, {
      state: 'ENDED',
      endedAt: serverTimestamp(),
    });
  });
}

export async function startGame(code: string, hostUid: string): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('No se encontró la sala.');
    }

    const room = roomSnap.data()!;

    if (room.hostUid !== hostUid) {
      throw new Error('Only host can start the game');
    }

    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    if (room.state !== 'LOBBY') throw new Error('La partida ya comenzó.');
    if (!eligibleJudges(room).length) throw new Error('Al menos una persona debe presentar imágenes.');
    // Keep indices monotonic across rematches so old guesses and counters never leak.
    const roundIndex = room.totalTurns || room.endedAt ? room.roundIndex + 1 : 0;
    const roundId = `round-${roundIndex}`;
    const roundRef = doc(db, `rooms/${code}/rounds/${roundId}`);
    const counterRef = doc(db, `rooms/${code}/rounds/${roundId}/_counter/meta`);
    const shuffledTurnOrder = shuffle(room.players.map(p => p.uid));

    const playersSkipJudge: Record<string, boolean> = {};
    for (const p of room.players) {
      playersSkipJudge[p.uid] = p.skipJudge;
    }

    const judgeUid = getNextJudgeUid(shuffledTurnOrder, 0, playersSkipJudge);

    const resetScores: Record<string, number> = {};
    for (const p of room.players) {
      resetScores[p.uid] = 0;
    }

    transaction.update(roomRef, {
      state: 'PLAYING',
      roundIndex,
      gameStartRoundIndex: roundIndex,
      matchPlayers: room.players,
      totalTurns: eligibleJudges(room).length * (room.roundsPerGame || DEFAULT_ROUNDS_PER_GAME),
      endedAt: deleteField(),
      turnOrder: shuffledTurnOrder,
      cumulativeScores: resetScores,
    });

    const roundDoc: RoundDoc = {
      id: roundId,
      roundIndex,
      judgeUid,
      imageRef: '',
      width: 0,
      height: 0,
      shapeCount: 0,
      playback: {
        playing: false,
        rate: 0,
        anchorStep: 0,
        anchorAt: serverTimestamp() as any,
      },
      startedAt: serverTimestamp() as any,
      roundTimerSecs: room.roundTimerSecs,
      graceTimerSecs: room.graceTimerSecs,
      state: 'TURN_START',
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

export async function returnToLobby(code: string, hostUid: string): Promise<void> {
  const roomRef = typedDoc<RoomDoc>('rooms', code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error('No se encontró la sala.');
    const room = snapshot.data()!;
    if (room.hostUid !== hostUid || room.state !== 'ENDED') throw new Error('Solo el anfitrión puede preparar la revancha.');
    transaction.update(roomRef, { state: 'LOBBY' });
  });
}
