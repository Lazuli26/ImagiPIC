import React, { createContext, useContext, ReactNode } from "react";
import { RoomDoc, RoundDoc } from "../types/database";

export interface GameContextValue {
  currentRoom: RoomDoc | null;
  setCurrentRoom: (room: RoomDoc | null) => void;
  currentRound: RoundDoc | null;
  setCurrentRound: (round: RoundDoc | null) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export const CurrentRoomContext = createContext<RoomDoc | null>(null);
export const CurrentRoundContext = createContext<RoundDoc | null>(null);

export interface GameProviderProps {
  children: ReactNode;
  initialRoom?: RoomDoc | null;
  initialRound?: RoundDoc | null;
}

export const GameProvider: React.FC<GameProviderProps> = ({
  children,
  initialRoom = null,
  initialRound = null,
}) => {
  const [currentRoom, setCurrentRoom] = React.useState<RoomDoc | null>(initialRoom);
  const [currentRound, setCurrentRound] = React.useState<RoundDoc | null>(initialRound);

  const value: GameContextValue = {
    currentRoom,
    setCurrentRoom,
    currentRound,
    setCurrentRound,
  };

  return (
    <GameContext.Provider value={value}>
      <CurrentRoomContext.Provider value={currentRoom}>
        <CurrentRoundContext.Provider value={currentRound}>
          {children}
        </CurrentRoundContext.Provider>
      </CurrentRoomContext.Provider>
    </GameContext.Provider>
  );
};

export function useGameContext(): GameContextValue | null {
  return useContext(GameContext);
}

export function useCurrentRoom(): RoomDoc | null {
  return useContext(CurrentRoomContext);
}

export function useCurrentRound(): RoundDoc | null {
  return useContext(CurrentRoundContext);
}
