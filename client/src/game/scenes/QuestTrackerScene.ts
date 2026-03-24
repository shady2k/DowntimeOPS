import Phaser from "phaser";
import { useGameStore } from "../../store/gameStore";
import { useBrowserStore } from "../../ui/browser/browserStore";

/**
 * QuestTrackerScene — always-on-top quest HUD overlay.
 * Renders in bottom-right corner, visible in both world and rack views.
 * Hides when browser is open to avoid click conflicts.
 */
export class QuestTrackerScene extends Phaser.Scene {
  private questBg!: Phaser.GameObjects.Rectangle;
  private questTitle!: Phaser.GameObjects.Text;
  private questHint!: Phaser.GameObjects.Text;
  private questStep!: Phaser.GameObjects.Text;
  private questProgress!: Phaser.GameObjects.Text;

  private unsubscribe?: () => void;
  private _unsubBrowser?: () => void;

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
    this._unsubBrowser = useBrowserStore.subscribe(() => this.updateTracker());
    this.updateTracker();
  }

  private updateTracker() {
    const state = useGameStore.getState().state;
    const browserOpen = useBrowserStore.getState().open;
    if (!state) return;

    // Hide when browser is open to prevent click conflicts
    if (browserOpen) {
      this.setAllVisible(false);
      return;
    }

    const activeId = state.quests?.activeQuestId;
    const quest = activeId ? state.quests?.quests?.[activeId] : null;
    if (quest && quest.status === "active") {
      const step = quest.steps[quest.currentStepIndex];
      const done = quest.steps.filter((s) => s.completed).length;

      this.questBg.setVisible(true);
      this.questTitle.setText(quest.title.toUpperCase()).setVisible(true);
      this.questProgress.setText(`${done}/${quest.steps.length}`).setVisible(true);
      this.questHint.setText(step?.hint || "").setVisible(true);
      this.questStep.setText(step?.title || "").setVisible(true);
    } else {
      this.setAllVisible(false);
    }
  }

  private setAllVisible(visible: boolean) {
    this.questBg.setVisible(visible);
    this.questTitle.setVisible(visible);
    this.questProgress.setVisible(visible);
    this.questHint.setVisible(visible);
    this.questStep.setVisible(visible);
  }

  destroy() {
    this.unsubscribe?.();
    this._unsubBrowser?.();
  }
}
