import type { GameState } from "../types/GameState";
import type { SaveInfo } from "../types/Common";

export type { SaveInfo };

export interface GameStorage {
  save(saveId: string, state: GameState): Promise<void>;
  load(saveId: string): Promise<GameState>;
  delete(saveId: string): Promise<void>;
  list(): Promise<SaveInfo[]>;
}
