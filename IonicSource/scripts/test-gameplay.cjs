// Integration regression suite. Runs against the local emulator, never production.
// npx firebase emulators:exec --only firestore --project demo-imagipic-gameplay --config firebase.gameplay-test.json "node IonicSource/scripts/test-gameplay.cjs"
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, deleteField, writeBatch } = require('firebase/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this suite with firebase emulators:exec.');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('A local emulator is required.');
const app = initializeApp({ projectId: 'demo-imagipic-gameplay' }, 'gameplay-host');
const db = getFirestore(app);
connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: 'host', user_id: 'host' } });
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};
const firebaseModule = path.resolve(__dirname, '../src/firebase/firebaseApp.ts');
require.cache[firebaseModule] = { id: firebaseModule, filename: firebaseModule, loaded: true, exports: { db } };
const { createRoom, getNextJudgeUid, updateRoomSettings, startGame, returnToLobby, joinRoom, toggleSkipJudge, endGame, leaveRoom } = require('../src/game/roomOperations.ts');
const { advanceRound, scoreRound, selectRoundImage } = require('../src/game/roundOperations.ts');
const withDb = async (connection, action) => {
  const original = require.cache[firebaseModule].exports.db;
  require.cache[firebaseModule].exports.db = connection;
  try { return await action(); }
  finally { require.cache[firebaseModule].exports.db = original; }
};
const read = async ref => (await getDoc(ref)).data();

async function main() {
  const code = await createRoom({ uid: 'host', displayName: 'Ana', photoURL: '' });
  const roomRef = doc(db, 'rooms', code);
  await joinRoom(code, { uid: 'guest', displayName: 'Beto', photoURL: '' });
  await joinRoom(code, { uid: 'guesser', displayName: 'Caro', photoURL: '' });
  await toggleSkipJudge(code, 'guesser', true);
  await updateRoomSettings(code, 'host', { roundsPerGame: 1, scoreboardTimerSecs: 0, maxPlayers: 3, roundTimerSecs: 30, graceTimerSecs: 10 });
  await assert.rejects(() => updateRoomSettings(code, 'host', { maxPlayers: 2 }));
  await assert.rejects(() => updateRoomSettings(code, 'host', { roundsPerGame: 0 }));
  assert.deepEqual([0, 1, 2, 3].map(i => getNextJudgeUid(['host', 'guesser', 'guest'], i, { host: false, guesser: true, guest: false })), ['host', 'guest', 'host', 'guest']);
  await startGame(code, 'host');
  let room = await read(roomRef);
  assert.equal(room.totalTurns, 2);
  assert.equal(room.gameStartRoundIndex, 0);
  await assert.rejects(() => startGame(code, 'host'));
  await assert.rejects(() => updateRoomSettings(code, 'host', { roundTimerSecs: 90 }));
  await assert.rejects(() => toggleSkipJudge(code, 'host', true));
  await assert.rejects(() => joinRoom(code, { uid: 'late', displayName: 'Late', photoURL: '' }));
  await assert.rejects(() => advanceRound(code, 1, 'guesser'));
  console.log('PASS: settings, fixed match length, presenter rotation, no mid-game joins or edits');

  const judges = [];
  const completedScores = [];
  let guesserTotal = 0;
  for (let index = 0; index < 2; index++) {
    const roundRef = doc(db, 'rooms', code, 'rounds', `round-${index}`);
    const round = await read(roundRef);
    judges.push(round.judgeUid);
    const judgeApp = initializeApp({ projectId: 'demo-imagipic-gameplay' }, `judge-${index}`);
    const judgeDb = getFirestore(judgeApp);
    connectFirestoreEmulator(judgeDb, host, Number(port), { mockUserToken: { sub: round.judgeUid, user_id: round.judgeUid } });
    const judgeRoundRef = doc(judgeDb, 'rooms', code, 'rounds', `round-${index}`);
    // Waiting to select an image must not count against the guessing timer.
    await updateDoc(judgeRoundRef, { startedAt: Timestamp.fromMillis(Date.now() - 600000) });
    const image = {
      id: 'fixture', ownerUid: round.judgeUid, width: 100, height: 100,
      shapeCount: 10, shapesCompact: Array.from({ length: 10 }, (_, x) => [6, 255, 4, x, 0, 10, 10]).flat(),
    };
    for (const invalid of [{ type: 'shuffle', seed: 'abc', degrees: 90 }, { type: 'hue-shift', degrees: 181 },
      { type: 'hue-shift', degrees: 1.5 }, { type: 'shuffle', seed: 'a'.repeat(65) }]) {
      await assert.rejects(() => withDb(judgeDb, () => selectRoundImage(code, index, round.judgeUid, image, invalid)));
    }
    const imageModifier = index === 0 ? { type: 'black-and-white' } : { type: 'hue-shift', degrees: -90 };
    await withDb(judgeDb, () => selectRoundImage(code, index, round.judgeUid, image, imageModifier));
    const processing = await read(roundRef);
    assert.equal(processing.state, 'PROCESSING');
    assert.deepEqual(processing.imageModifier, imageModifier);
    assert.equal(processing.startedAt, null);
    assert.equal(processing.playback.playing, false);
    assert.equal(processing.playback.anchorStep, 5);
    const guesserApp = initializeApp({ projectId: 'demo-imagipic-gameplay' }, `guesser-${index}`);
    const guesserDb = getFirestore(guesserApp);
    connectFirestoreEmulator(guesserDb, host, Number(port), { mockUserToken: { sub: 'guesser', user_id: 'guesser' } });
    const guesserRoundRef = doc(guesserDb, 'rooms', code, 'rounds', `round-${index}`);
    await assert.rejects(() => updateDoc(guesserRoundRef, { imageModifier: { type: 'black-and-white' } }));
    // The confirmed effect is already present on the first shared snapshot.
    await assert.rejects(() => updateDoc(judgeRoundRef, { imageModifier: { type: 'none' } }));
    await updateDoc(judgeRoundRef, { state: 'IN_PROGRESS', startedAt: serverTimestamp(),
      participantUids: (await read(roomRef)).players.map(player => player.uid),
      playback: { ...processing.playback, playing: true, anchorAt: serverTimestamp() },
    });
    const started = await read(roundRef);
    assert(started.playback.anchorAt.isEqual(started.startedAt));
    assert.deepEqual(started.imageModifier, imageModifier);
    assert.deepEqual(started.participantUids, (await read(roomRef)).players.map(player => player.uid));
    await assert.rejects(() => updateDoc(judgeRoundRef, { imageModifier: { type: 'none' } }));
    await assert.rejects(() => updateDoc(guesserRoundRef, { imageModifier: { type: 'none' } }));
    const guessPath = ['rooms', code, 'rounds', `round-${index}`, 'guesses', 'answer'];
    await setDoc(doc(guesserDb, ...guessPath), { id: 'answer', uid: 'guesser', displayName: 'Caro', textRaw: 'Sol', textNormalized: 'sol', submittedAt: serverTimestamp(), verdict: null, verdictAt: null, verdictBy: null });
    const answerRef = doc(judgeDb, ...guessPath);
    // Use the same batch shape as the judge's buttons: every decision writes
    // stars, including null for incorrect answers and undone decisions.
    const rateAnswer = async (verdict, stars) => {
      const batch = writeBatch(judgeDb);
      batch.update(answerRef, { verdict, stars,
        verdictAt: verdict === null ? null : serverTimestamp(),
        verdictBy: verdict === null ? null : round.judgeUid });
      await batch.commit();
    };
    await assert.rejects(() => updateDoc(doc(guesserDb, ...guessPath), { verdict: 'CORRECT', stars: 3, verdictAt: serverTimestamp(), verdictBy: 'guesser' }));
    for (const stars of [0, 4, 1.5]) {
      await assert.rejects(() => updateDoc(answerRef, { verdict: 'CORRECT', stars, verdictAt: serverTimestamp(), verdictBy: round.judgeUid }));
    }
    await rateAnswer('WRONG', null);
    assert.equal((await read(answerRef)).verdict, 'WRONG');
    await rateAnswer(null, null);
    assert.equal((await read(answerRef)).verdict, null);
    await rateAnswer('CORRECT', 1);
    assert.equal((await read(answerRef)).stars, 1);
    // Exercise the judge's early review transition and real timestamp validation.
    await updateDoc(judgeRoundRef, { state: 'ADJUDICATION', adjudicationStartedAt: serverTimestamp() });
    const reviewing = await read(roundRef);
    assert(reviewing.adjudicationStartedAt instanceof Timestamp);
    await rateAnswer('CORRECT', 2);
    await rateAnswer('CORRECT', 3);
    // Ordinary players cannot skip the judge's review countdown.
    await assert.rejects(() => updateDoc(doc(guesserDb, 'rooms', code, 'rounds', `round-${index}`), { state: 'ADJUDICATION_CLOSED' }));
    await updateDoc(judgeRoundRef, { state: 'ADJUDICATION_CLOSED' });
    await assert.rejects(() => rateAnswer('CORRECT', 1));
    await Promise.all([scoreRound(code, index, 'host'), scoreRound(code, index, 'host')]);
    const awarded = (await read(roundRef)).results.perPlayerScores;
    const savedResults = (await read(roundRef)).results;
    assert.equal(savedResults.scoringVersion, 2);
    assert.equal(savedResults.guesserCount, 2);
    assert.equal(savedResults.breakdown.guesser.base, 80);
    assert.equal(savedResults.breakdown.guesser.base + savedResults.breakdown.guesser.speed, awarded.guesser);
    assert(awarded.guesser >= 80 && awarded.guesser <= 100);
    completedScores.push(awarded.guesser);
    guesserTotal += awarded.guesser;
    assert.equal(awarded[round.judgeUid], 40);
    assert.equal((await read(roomRef)).cumulativeScores.guesser, guesserTotal);
    // Duplicate requests must not create two rounds or end the next round early.
    await Promise.all([advanceRound(code, index + 1, 'guesser'), advanceRound(code, index + 1, 'guesser')]);
    await deleteApp(judgeApp); await deleteApp(guesserApp);
  }
  assert.equal(new Set(judges).size, 2);
  room = await read(roomRef);
  assert.equal(room.state, 'ENDED');
  assert.equal(room.roundIndex, 1);
  assert.equal(room.cumulativeScores.guesser, guesserTotal);
  assert.equal((await getDoc(doc(db, 'rooms', code, 'rounds', 'round-2'))).exists(), false);
  console.log('PASS: private modifier confirmation, immutable effects, editable stars until review closes, judge scoring exactly once, automatic final');

  const leavingApp = initializeApp({ projectId: 'demo-imagipic-gameplay' }, 'leaving-player');
  const leavingDb = getFirestore(leavingApp);
  connectFirestoreEmulator(leavingDb, host, Number(port), { mockUserToken: { sub: 'guesser', user_id: 'guesser' } });
  const originalRoster = room.matchPlayers;
  await withDb(leavingDb, () => leaveRoom(code, 'guesser'));
  room = await read(roomRef);
  assert.equal(room.players.some(player => player.uid === 'guesser'), false);
  assert.equal(room.cumulativeScores.guesser, guesserTotal);
  assert.deepEqual(room.matchPlayers, originalRoster);
  console.log('PASS: non-host self-leave preserves final scores and the match roster');

  // Preserve old results/guesses and prove a rematch creates entirely new IDs.
  await setDoc(doc(db, 'rooms', code, 'rounds', 'round-0', '_counter', 'meta'), { roundId: 'round-0', lastGuessAtMs: { guest: 123 }, perUidGuessCount: { guest: 2 } });
  await returnToLobby(code, 'host');
  await withDb(leavingDb, () => joinRoom(code, { uid: 'guesser', displayName: 'Caro', photoURL: '' }));
  await deleteApp(leavingApp);
  await toggleSkipJudge(code, 'guesser', true);
  await startGame(code, 'host');
  room = await read(roomRef);
  assert.equal(room.roundIndex, 2);
  assert.equal(room.gameStartRoundIndex, 2);
  assert.deepEqual(room.cumulativeScores, { host: 0, guest: 0, guesser: 0 });
  assert.equal((await read(doc(db, 'rooms', code, 'rounds', 'round-0'))).results.perPlayerScores.guesser, completedScores[0]);
  assert.equal((await read(doc(db, 'rooms', code, 'rounds', 'round-0', '_counter', 'meta'))).perUidGuessCount.guest, 2);
  assert.deepEqual((await read(doc(db, 'rooms', code, 'rounds', 'round-2', '_counter', 'meta'))).perUidGuessCount, {});
  await endGame(code, 'host');
  await returnToLobby(code, 'host');
  await toggleSkipJudge(code, 'host', true);
  await toggleSkipJudge(code, 'guest', true);
  await assert.rejects(() => startGame(code, 'host'));
  console.log('PASS: rematch resets scores, keeps history isolated, rejects no-presenter games');
  await toggleSkipJudge(code, 'host', false);
  await startGame(code, 'host');
  await endGame(code, 'host');
  await updateDoc(roomRef, { matchPlayers: deleteField() });
  const legacyPlayers = (await read(roomRef)).players;
  const legacyApp = initializeApp({ projectId: 'demo-imagipic-gameplay' }, 'legacy-leave');
  const legacyDb = getFirestore(legacyApp);
  connectFirestoreEmulator(legacyDb, host, Number(port), { mockUserToken: { sub: 'guest', user_id: 'guest' } });
  await withDb(legacyDb, () => leaveRoom(code, 'guest'));
  room = await read(roomRef);
  assert.deepEqual(room.matchPlayers, legacyPlayers);
  assert.equal(room.cumulativeScores.guest, 0);
  await leaveRoom(code, 'host');
  room = await read(roomRef);
  assert.equal(room.hostUid, 'guesser');
  assert.deepEqual(room.matchPlayers, legacyPlayers);
  await deleteApp(legacyApp);
  console.log('PASS: legacy final results survive self-leave and host promotion');
}
main().then(() => deleteApp(app)).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(process.exitCode || 0), 100));
