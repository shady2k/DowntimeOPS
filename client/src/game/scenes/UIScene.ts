import Phaser from "phaser";
import { useGameStore, type GameStore } from "../../store/gameStore";

/**
 * UIScene — screen-space HUD overlay.
 * Runs on top of WorldScene, not affected by camera.
 */
export class UIScene extends Phaser.Scene {
  // HUD elements
  private moneyText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;

  private unsubscribe?: () => void;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    const { width, height } = this.cameras.main;

    // --- Top HUD bar ---
    this.add.rectangle(width / 2, 20, width, 40, 0x1e1814, 0.85);

    this.moneyText = this.add.text(10, 6, "$0", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#60c070",
      fontStyle: "bold",
    });

    this.roomText = this.add.text(width / 2, 6, "Outside", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#f0e0cc",
    }).setOrigin(0.5, 0);

    // --- Objective panel (bottom-left) ---
    this.objectiveText = this.add.text(10, height - 30, "", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#d4a040",
      backgroundColor: "#1e1814cc",
      padding: { x: 4, y: 2 },
      wordWrap: { width: 300 },
    });

    // Controls hint
    this.add.text(width - 180, height - 16, "WASD: Move  |  E: Interact", {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#706050",
    });

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      this.updateHUD(store);
    });

    // Initial update
    this.updateHUD(useGameStore.getState());
  }

  private updateHUD(store: GameStore) {
    const state = store.state;
    if (!state) return;

    this.moneyText.setText(`$${state.money.toLocaleString()}`);

    // Room name
    const player = state.world?.player;
    if (player) {
      const room = state.world.rooms[player.roomId];
      this.roomText.setText(room?.name || player.roomId);

      // Carrying indicator
      if (player.carryingItemId) {
        const item = state.world.items[player.carryingItemId];
        this.roomText.setText(
          `${room?.name || player.roomId}  •  Carrying: ${item?.kind || "item"}`,
        );
      }
    }

    // Current objective
    if (state.tutorial && !state.tutorial.tutorialComplete) {
      const currentObj = state.tutorial.objectives[state.tutorial.currentObjectiveIndex];
      if (currentObj) {
        this.objectiveText.setText(`📋 ${currentObj.title}`);
      }
    }
  }

  destroy() {
    this.unsubscribe?.();
  }
}
