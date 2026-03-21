import Phaser from "phaser";
import { useGameStore, type GameStore } from "../../store/gameStore";

/**
 * UIScene — screen-space HUD overlay.
 * Runs on top of WorldScene, not affected by camera.
 */
export class UIScene extends Phaser.Scene {
  // HUD elements
  private roomText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;

  private unsubscribe?: () => void;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    // Zoom camera by DPR to keep logical coords at 960x540
    const dpr = window.devicePixelRatio || 1;
    this.cameras.main.setZoom(dpr);
    this.cameras.main.setBounds(0, 0, 960, 540);
    this.cameras.main.centerOn(480, 270);

    const width = 960;
    const height = 540;

    // --- Top HUD bar ---
    this.add.rectangle(width / 2, 20, width, 40, 0x1e1814, 0.85);

    this.roomText = this.add.text(width / 2, 6, "Outside", {
      fontSize: "14px",
      fontFamily: "'Nunito', sans-serif",
      color: "#f0e0cc",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setResolution(dpr);

    // --- Objective panel (bottom-left) ---
    this.objectiveText = this.add.text(10, height - 30, "", {
      fontSize: "12px",
      fontFamily: "'Nunito', sans-serif",
      color: "#d4a040",
      backgroundColor: "#1e1814cc",
      padding: { x: 6, y: 3 },
      wordWrap: { width: 350 },
    }).setResolution(dpr);

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

    // Room name
    const player = state.world?.player;
    if (player) {
      const room = state.world.rooms[player.roomId];
      this.roomText.setText(room?.name || player.roomId);
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
