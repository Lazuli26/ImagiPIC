import type { Timestamp } from "firebase/firestore";
import type { ImageSourceCredit } from '../utils/commonsImages';

export type RoomState = "LOBBY" | "PLAYING" | "SCOREBOARD" | "ENDED";

export type RoundState =
  | "TURN_START"
  | "PROCESSING"
  | "IN_PROGRESS"
  | "ADJUDICATION"
  | "ADJUDICATION_CLOSED"
  | "SCORED"
  | "SCOREBOARD";

export type Verdict = null | "WRONG" | "CORRECT";
export type CorrectStars = 1 | 2 | 3;

export enum CompactShapeType {
  ROTATED_RECTANGLE = 0,
  ROTATED_ELLIPSE = 1,
  TRIANGLE = 2,
  CIRCLE = 3,
  LINE = 4,
  QUADRATIC_BEZIER = 5,
  RECTANGLE = 6,
}

// Flat row layout (single-level number array — Firestore forbids nested arrays):
//   Index:   [0]           CompactShapeType (integer 0..6)
//            [1]           ARGB color (signed 32-bit integer, use >>>0 for unsigned)
//            [2]           params.length (N) — header tells how many numeric params follow
//            [3..2+N]     shape params (N numbers, layout per shape type)
// N is bounded: ROTATED_RECTANGLE/ELLIPSE N=5, TRIANGLE N=6, CIRCLE N=3, LINE N=5,
//              QUADRATIC_BEZIER N=6 or 7 (optional stroke width), RECTANGLE N=4.
//              Max total length = 2 + 1 + 7 = 10.
export type CompactShapeRow = readonly number[];

export interface UserDoc {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  totalGamesPlayed?: number;
}

export interface RoomPlayer {
  uid: string;
  displayName: string;
  photoURL: string;
  isHost: boolean;
  skipJudge: boolean;
  connectedAt: Timestamp;
}

export interface RoomDoc {
  code: string;
  hostUid: string;
  state: RoomState;
  players: RoomPlayer[];
  matchPlayers?: RoomPlayer[];
  turnOrder: string[];
  roundIndex: number;
  maxPlayers: number;
  roundsPerGame?: number;
  totalTurns?: number;
  gameStartRoundIndex?: number;
  scoreboardTimerSecs?: number;
  roundTimerSecs: number;
  graceTimerSecs: number;
  createdAt: Timestamp;
  endedAt?: Timestamp;
  cumulativeScores: { [uid: string]: number };
}

export interface PlaybackState {
  playing: boolean;
  rate: number;
  anchorStep: number;
  anchorAt: Timestamp;
}

export type ImageModifier =
  | { type: 'none' }
  | { type: 'shuffle'; seed: string }
  | { type: 'hue-shift'; degrees: number }
  | { type: 'black-and-white' };

export interface RoundDoc {
  id: string;
  roundIndex: number;
  judgeUid: string;
  imageRef: string;
  width: number;
  height: number;
  shapeCount: number;
  // IMPORTANT: single-level number[] (NOT array of arrays). Firestore forbids nested arrays.
  // Chunk layout per shape: [ type, argbColor32, paramsLength, ...params ].
  // Read with unflattenShapes codec helper to yield individual rows (or iterate with cursor).
  shapesCompactCopy?: number[];
  imageModifier?: ImageModifier;
  playback: PlaybackState;
  startedAt: Timestamp;
  roundTimerSecs: number;
  graceTimerSecs: number;
  state: RoundState;
  adjudicationStartedAt?: Timestamp;
  // Frozen when the guessing clock starts; leaving later cannot change awards.
  participantUids?: string[];
  scoredAt?: Timestamp;
  guessesCount?: number;
  unjudgedCount?: number;
  results?: {
    perPlayerScores: Record<string, number>;
    rankOrder: string[];
    scoringVersion?: number;
    breakdown?: Record<string, { base: number; speed: number }>;
    guesserCount?: number;
  };
}

export interface GuessDoc {
  id: string;
  uid: string;
  displayName: string;
  textRaw: string;
  textNormalized: string;
  submittedAt: Timestamp;
  verdict: Verdict;
  // Missing on legacy answers: CORRECT defaults to three stars.
  stars?: CorrectStars | null;
  verdictAt: Timestamp | null;
  verdictBy: string | null;
}

export interface DeckImageOptions {
  shapeTypes: CompactShapeType[];
  candidateShapesPerStep: number;
  shapeMutationsPerStep: number;
  alpha: number;
  maxPixels: number;
}

export interface DeckImageDoc {
  id: string;
  ownerUid: string;
  label?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  width: number;
  height: number;
  shapeCount: number;
  options: DeckImageOptions;
  // IMPORTANT: single-level number[] (NOT array of arrays). Firestore forbids nested arrays.
  // Chunk layout per shape: [ type, argbColor32, paramsLength, ...params ].
  // Read with unflattenShapes codec helper to yield individual rows (or iterate with cursor).
  shapesCompact: number[];
  previewDataUrl?: string;
  imageSource?: ImageSourceCredit;
}

export interface DeckMetaDoc {
  uid: string;
  count: number;
  updatedAt: Timestamp;
}

export interface AppSettingsDoc {
  forceSquareImages?: boolean;
}

export interface RoundCounterDoc {
  roundId: string;
  lastGuessAtMs: Record<string, number>;
  perUidGuessCount: Record<string, number>;
  previewReadyUids?: string[];
}
