import Phaser from "phaser";
import { useGameStore, type GameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

/**
 * UIScene — screen-space HUD overlay.
 * Runs on top of WorldScene, not affected by camera.
 */
export class UIScene extends Phaser.Scene {
  // HUD elements
  private moneyText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;

  // Shop panel
  private shopPanel!: Phaser.GameObjects.Container;
  private shopVisible = false;

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

    // --- Shop panel (hidden by default) ---
    this.shopPanel = this.createShopPanel();
    this.shopPanel.setVisible(false);

    // Controls hint
    this.add.text(width - 180, height - 16, "WASD: Move  |  E: Interact", {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#706050",
    });

    // Listen for shop open events from WorldScene
    const worldScene = this.scene.get("WorldScene");
    worldScene.events.on("openShop", () => this.toggleShop());

    // ESC closes shop
    this.input.keyboard!.on("keydown-ESC", () => {
      if (this.shopVisible) this.toggleShop();
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

    // Update shop listings if visible
    if (this.shopVisible) {
      this.refreshShopListings();
    }
  }

  private createShopPanel(): Phaser.GameObjects.Container {
    const { width, height } = this.cameras.main;
    const panelW = 320;
    const panelH = 400;
    const panelX = width / 2;
    const panelY = height / 2;

    const container = this.add.container(panelX, panelY);

    // Background
    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x1e1814, 0.95);
    bg.setStrokeStyle(2, 0x6a5540);
    container.add(bg);

    // Title
    const title = this.add.text(0, -panelH / 2 + 20, "EQUIPMENT SHOP", {
      fontSize: "18px",
      color: "#e8a840",
      fontStyle: "bold",
    }).setOrigin(0.5);
    container.add(title);

    // Close button
    const closeBtn = this.add.text(
      panelW / 2 - 20, -panelH / 2 + 10,
      "X",
      { fontSize: "18px", color: "#d45a4a" },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.toggleShop());
    container.add(closeBtn);

    // Listing items will be added dynamically
    container.setDepth(200);
    return container;
  }

  private refreshShopListings() {
    const state = useGameStore.getState().state;
    if (!state?.world?.shop) return;

    // Remove old listing items (keep bg + title + close = first 3)
    while (this.shopPanel.length > 3) {
      const child = this.shopPanel.getAt(3);
      (child as Phaser.GameObjects.GameObject).destroy();
      this.shopPanel.removeAt(3);
    }

    const listings = Object.values(state.world.shop.listings);
    let y = -120;

    for (const listing of listings) {
      const canAfford = state.money >= listing.price;

      // Item row
      const nameText = this.add.text(-130, y, listing.name, {
        fontSize: "14px",
        color: canAfford ? "#f0e0cc" : "#706050",
      });

      const priceText = this.add.text(100, y, `$${listing.price}`, {
        fontSize: "14px",
        color: canAfford ? "#60c070" : "#d45a4a",
        fontStyle: "bold",
      });

      // Buy button
      const buyBtn = this.add.text(100, y + 18, canAfford ? "[BUY]" : "[---]", {
        fontSize: "12px",
        color: canAfford ? "#e8a840" : "#504840",
      });

      if (canAfford) {
        buyBtn.setInteractive({ useHandCursor: true });
        const listingId = listing.id;
        buyBtn.on("pointerdown", () => {
          rpcClient.call("buyItem", { listingId });
          this.toggleShop();
        });
        buyBtn.on("pointerover", () => buyBtn.setColor("#ffffff"));
        buyBtn.on("pointerout", () => buyBtn.setColor("#e8a840"));
      }

      this.shopPanel.add([nameText, priceText, buyBtn]);
      y += 50;
    }
  }

  private toggleShop() {
    this.shopVisible = !this.shopVisible;
    this.shopPanel.setVisible(this.shopVisible);
    if (this.shopVisible) {
      this.refreshShopListings();
    }
  }

  destroy() {
    this.unsubscribe?.();
  }
}
