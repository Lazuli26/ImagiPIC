import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { IonApp, IonPage, IonHeader, IonToolbar, IonTitle, IonContent, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '../src/theme/variables.css';
import '../src/pages/Room.css';
import TurnPlayback from '../src/components/game/TurnPlayback';
import TurnSetupModal from '../src/components/TurnSetupModal';
import DeckBuilderModal from '../src/components/DeckBuilderModal';
import JoinRoomModal from '../src/components/JoinRoomModal';
import type { ImageModifier } from '../src/types/database';
import { useVisualViewport } from '../src/utils/useVisualViewport';
import { encodeAllFromShapeJsonList, flattenShapes } from '../src/utils/compactShapeCodec';
import { answers, setDeckImages } from './mobile-fixture-api';

setupIonicReact();
const shapeData = [
  { type: 'RECTANGLE', color: [255, 255, 255, 255], data: [0, 0, 100, 100] },
  { type: 'RECTANGLE', color: [255, 0, 0, 255], data: [0, 0, 50, 50] },
  { type: 'RECTANGLE', color: [0, 0, 255, 128], data: [25, 0, 75, 50] },
  { type: 'TRIANGLE', color: [0, 255, 0, 255], data: [0, 50, 50, 50, 0, 100] },
  { type: 'CIRCLE', color: [0, 0, 0, 0], data: [10, 10, 8] },
  { type: 'ROTATED_RECTANGLE', color: [255, 128, 0, 255], data: [65, 65, 90, 80, 30] },
  { type: 'ROTATED_ELLIPSE', color: [100, 20, 200, 128], data: [75, 30, 15, 5, -45] },
  { type: 'LINE', color: [0, 255, 255, 128], data: [10, 65, 30, 90, 3] },
  { type: 'QUADRATIC_BEZIER', color: [0, 0, 0, 255], data: [50, 100, 50, 50, 100, 50, 2] },
];
const round: any = {
  id: 'round-0', roundIndex: 0, judgeUid: 'judge', imageRef: 'user_decks/judge/images/test',
  width: 100, height: 100, shapesCompactCopy: flattenShapes(encodeAllFromShapeJsonList(shapeData)),
  shapeCount: shapeData.length, state: 'IN_PROGRESS', roundTimerSecs: 3600, graceTimerSecs: 10,
  startedAt: { toMillis: () => Date.now() }, playback: { playing: false, rate: 1, anchorStep: 5, anchorAt: null },
};
const Fixture = () => {
  const ref = useRef<HTMLDivElement>(null);
  useVisualViewport(ref);
  const [currentRound, setCurrentRound] = useState(round);
  const [isJudge, setIsJudge] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joined, setJoined] = useState('');
  const [roomClicks, setRoomClicks] = useState(0);
  useEffect(() => {
    const update = (event: Event) => setCurrentRound((value: any) => ({ ...value, ...(event as CustomEvent).detail }));
    window.addEventListener('fixture-round-update', update);
    return () => window.removeEventListener('fixture-round-update', update);
  }, []);
  (window as any).fixture = {
    answers,
    currentRound,
    join: () => setJoinOpen(true),
    step: (step: number) => setCurrentRound((value: any) => ({ ...value, playback: { ...value.playback, playing: false, anchorStep: step } })),
    judge: setIsJudge,
    setup: () => {
      setDeckImages([{ id: 'fixture', label: 'Imagen de prueba', ownerUid: 'judge', width: 100, height: 100,
        shapeCount: round.shapeCount, shapesCompact: round.shapesCompactCopy, options: { shapeTypes: [6] } }]);
      setSelectionLocked(false); setPreviewOpen(true); setIsJudge(true);
    },
    builder: () => { setSaved(false); setBuilderOpen(true); },
  };
  return <IonApp>{joined ? <IonPage><IonContent><h1>Sala {joined}</h1><button onClick={() => setRoomClicks(value => value + 1)}>Comprobar sala</button><p>Interacciones: {roomClicks}</p></IonContent></IonPage> : <IonPage ref={ref} className="game-room">
    <IonHeader><IonToolbar><IonTitle>Turno de prueba</IonTitle></IonToolbar></IonHeader>
    <IonContent scrollY={false}><div style={{ height: '100%', width: '100%' }}><TurnPlayback code="TEST12"
      round={currentRound} currentUid={isJudge ? 'judge' : 'player'} currentUserName="Ana"
      isJudge={isJudge} judgeName="Presentador" players={[{ uid: 'player', displayName: 'Ana' }, { uid: 'judge', displayName: 'Presentador' }] as any} />
    </div></IonContent>
  </IonPage>}
    <TurnSetupModal isOpen={previewOpen} judgeUid="judge" currentUserUid={isJudge ? 'judge' : 'player'} ownerUid="judge" selectionLocked={selectionLocked}
      onDismiss={() => setPreviewOpen(false)} onSelectImage={async (_image, modifier: ImageModifier) => {
        // Firestore updates the round BEFORE its transaction promise resolves.
        setCurrentRound({ ...round, state: 'PROCESSING', startedAt: null, imageModifier: modifier });
        setPreviewOpen(false);
        await new Promise(resolve => setTimeout(resolve, 300));
        setSelectionLocked(true);
      }} />
    <DeckBuilderModal ownerUid="judge" isOpen={builderOpen} onDismiss={() => setBuilderOpen(false)} onSaved={() => setSaved(true)} />
    {saved && <p role="status">Carta guardada en la prueba</p>}
    <JoinRoomModal isOpen={joinOpen} onDismiss={() => setJoinOpen(false)} onJoin={async () => {}} onJoined={setJoined} />
  </IonApp>;
};
ReactDOM.render(<Fixture />, document.getElementById('root'));
