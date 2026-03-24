import Phaser from "phaser";
import { useGameStore, type GameStore } from "../../store/gameStore";

/**
 * UIScene — screen-space HUD overlay.
 * Runs on top of WorldScene, not affected by camera.
 */
export class UIScene extends Phaser.Scene {
  private roomText!: Phaser.GameObjects.Text;
  private unsubscribe?: () => void;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    const dpr = window.devicePixelRatio || 1;
    this.cameras.main.setZoom(dpr);
    this.cameras.main.setBounds(0, 0, 960, 540);
    this.cameras.main.centerOn(480, 270);

    const width = 960;

    // --- Top HUD bar ---
    this.add.rectangle(width / 2, 20, width, 40, 0x1e1814, 0.85);

    this.roomText = this.add.text(width / 2, 6, "Outside", {
      fontSize: "14px",
      fontFamily: "'Nunito', sans-serif",
      color: "#f0e0cc",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setResolution(dpr);

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      this.updateHUD(store);
    });
    this.updateHUD(useGameStore.getState());
  }

  private updateHUD(store: GameStore) {
    const state = store.state;
    if (!state) return;

    const player = state.world?.player;
    if (player) {
      const room = state.world.rooms[player.roomId];
      this.roomText.setText(room?.name || player.roomId);
    }
  }

  destroy() {
    this.unsubscribe?.();
  }
}
