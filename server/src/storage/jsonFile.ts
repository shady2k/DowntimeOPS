import type { GameState, GameStorage, SaveInfo } from "@downtime-ops/shared";
import { join } from "path";
import { mkdir } from "fs/promises";

const SAVES_DIR = join(import.meta.dir, "../../saves");

export class JsonFileStorage implements GameStorage {
  private dir: string;

  constructor(dir: string = SAVES_DIR) {
    this.dir = dir;
  }

  private filePath(saveId: string): string {
    return join(this.dir, `${saveId}.json`);
  }

  async save(saveId: string, state: GameState): Promise<void> {
    await mkdir(this.dir, { recursive: true });

    const saveData = {
      meta: {
        id: saveId,
        name: saveId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        phase: state.phase,
        money: state.money,
      },
      state,
    };

    await Bun.write(this.filePath(saveId), JSON.stringify(saveData, null, 2));
  }

  async load(saveId: string): Promise<GameState> {
    const file = Bun.file(this.filePath(saveId));
    if (!(await file.exists())) {
      throw new Error(`Save "${saveId}" not found`);
    }

    const data = await file.json();
    return data.state as GameState;
  }

  async delete(saveId: string): Promise<void> {
    const { unlink } = await import("fs/promises");
    try {
      await unlink(this.filePath(saveId));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async list(): Promise<SaveInfo[]> {
    const { readdir } = await import("fs/promises");
    try {
      const files = await readdir(this.dir);
      const saves: SaveInfo[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        try {
          const data = await Bun.file(join(this.dir, file)).json();
          saves.push(data.meta as SaveInfo);
        } catch {
          // Skip corrupt files
        }
      }

      return saves;
    } catch {
      return [];
    }
  }
}
