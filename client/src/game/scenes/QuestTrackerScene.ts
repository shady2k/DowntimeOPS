import Phaser from "phaser";
import { useGameStore } from "../../store/gameStore";

/**
 * QuestTrackerScene — always-on-top quest HUD overlay.
 * Renders in bottom-right corner, visible in both world and rack views.
 */
export class QuestTrackerScene extends Phaser.Scene {
  private questBg!: Phaser.GameObjects.Rectangle;
  private questTitle!: Phaser.GameObjects.Text;
  private questHint!: Phaser.GameObjects.Text;
  private questStep!: Phaser.GameObjects.Text;
  private questProgress!: Phaser.GameObjects.Text;

  private unsubscribe?: () => void;

  constructor() {
    super({ key: "QuestTrackerScene" });
  }

  create() {
    const dpr = window.devicePixelRatio || 1;
    this.cameras.main.setZoom(dpr);
    this.cameras.main.setBounds(0, 0, 960, 540);
    this.cameras.main.centerOn(480, 270);

    const width = 960;
    const qw = 230;
    const qh = 56;
    const qx = width - qw - 6;
    const qy = 540 - qh - 6;

    this.questBg = this.add.rectangle(qx + qw / 2, qy + qh / 2, qw, qh, 0x1e1814, 0.9)
      .setStrokeStyle(1, 0x332a20)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        useGameStore.getState().openQuestDetail();
      });

    this.questTitle = this.add.text(qx + 8, qy + 4, "", {
      fontSize: "8px",
      fontFamily: "'Nunito', sans-serif",
      color: "#706050",
      letterSpacing: 1,
    }).setResolution(dpr);

    this.questProgress = this.add.text(qx + qw - 8, qy + 4, "", {
      fontSize: "8px",
      fontFamily: "'Nunito', sans-serif",
      color: "#706050",
    }).setOrigin(1, 0).setResolution(dpr);

    this.questHint = this.add.text(qx + 8, qy + 15, "", {
      fontSize: "8px",
      fontFamily: "'Nunito', sans-serif",
      color: "#605040",
    }).setResolution(dpr);

    this.questStep = this.add.text(qx + 8, qy + 28, "", {
      fontSize: "11px",
      fontFamily: "'Nunito', sans-serif",
      color: "#e8a840",
      fontStyle: "bold",
      wordWrap: { width: qw - 16 },
    }).setResolution(dpr);

    this.unsubscribe = useGameStore.subscribe(() => this.updateTracker());
    this.updateTracker();
  }

  private updateTracker() {
    const state = useGameStore.getState().state;
    if (!state) return;

    const quest = state.quests?.quests?.first_contract;
    if (quest && quest.status === "active") {
      const step = quest.steps[quest.currentStepIndex];
      const done = quest.steps.filter((s) => s.completed).length;

      this.questBg.setVisible(true);
      this.questTitle.setText(quest.title.toUpperCase()).setVisible(true);
      this.questProgress.setText(`${done}/${quest.steps.length}`).setVisible(true);
      this.questHint.setText(step?.hint || "").setVisible(true);
      this.questStep.setText(step?.title || "").setVisible(true);
    } else {
      this.questBg.setVisible(false);
      this.questTitle.setVisible(false);
      this.questProgress.setVisible(false);
      this.questHint.setVisible(false);
      this.questStep.setVisible(false);
    }
  }

  destroy() {
    this.unsubscribe?.();
  }
}
