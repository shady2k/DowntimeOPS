import Phaser from "phaser";
import { generateTextures } from "./TextureGenerator";

/**
 * Asset preload scene.
 *
 * Two-stage asset loading:
 * 1. Load file-based assets (real art) — these take priority
 * 2. Generate placeholder textures for any keys not loaded from files
 *
 * To swap a placeholder for real art:
 * 1. Place the PNG in client/public/assets/{category}/
 * 2. Uncomment or add the corresponding load call below
 * 3. The loaded texture overrides the generated placeholder automatically
 *
 * See client/public/assets/ASSET_GUIDE.md for naming, sizing, and palette docs.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    // ── File-based asset loading ──

    // Backgrounds (one per location)
    this.load.image("bg-checkpoint", "assets/backgrounds/checkpoint.png");
    this.load.image("bg-yard", "assets/backgrounds/yard.png");
    this.load.image("bg-storage", "assets/backgrounds/storage.png");
    this.load.image("bg-datacenter", "assets/backgrounds/datacenter-interior.png");

    // Rack
    this.load.image("rack-frame", "assets/racks/rack-frame-42u.png");
    this.load.image("rack-empty", "assets/racks/rack-42u-empty.png");

    // Devices
    this.load.image("device-server", "assets/devices/device-server-1u.png");
    this.load.image("device-switch", "assets/devices/device-switch-24p.png");
    this.load.image("device-router", "assets/devices/device-router-1u.png");
    this.load.image("device-firewall", "assets/devices/device-firewall-1u.png");

    // Player — single spritesheet: frame 0 = idle, frames 1-8 = walk
    this.load.spritesheet("player-walk", "assets/player/player-walk.png", {
      frameWidth: 580,
      frameHeight: 940,
    });

    // UI
    this.load.image("ui-panel-bg", "assets/ui/panel-bg.png");
    this.load.image("ui-logo", "assets/ui/logo.png");

    // Rack scene — unified workstation background (full-screen scene plate)
    this.load.image("workstation-bg", "assets/backgrounds/workstation-bg.png");
    // Legacy fallback (bay only)
    this.load.image("bay-wall", "assets/backgrounds/bay-wall.png");

    // ── Not yet available — uncomment when ready ──
    //
    // Devices (atlas — use this instead of individual images for production)
    // this.load.atlas("devices", "assets/devices/devices.png", "assets/devices/devices.json");
    //
    // Overlays
    // this.load.image("overlay-selected", "assets/devices/overlay-selected.png");
    // this.load.image("overlay-active", "assets/devices/overlay-active.png");
    // this.load.image("overlay-degraded", "assets/devices/overlay-degraded.png");
    // this.load.image("overlay-failed", "assets/devices/overlay-failed.png");
    //
    // Ports
    // this.load.image("port-up", "assets/devices/port-up.png");
    // this.load.image("port-down", "assets/devices/port-down.png");
    // this.load.image("port-err", "assets/devices/port-err.png");
    // this.load.image("port-off", "assets/devices/port-off.png");
    // this.load.image("port-connected", "assets/devices/port-connected.png");
    //
    // Slot highlights
    // this.load.image("slot-valid", "assets/ui/slot-valid.png");
    // this.load.image("slot-invalid", "assets/ui/slot-invalid.png");
    // this.load.image("slot-hover", "assets/ui/slot-hover.png");
    //
    // FX
    // this.load.image("fx-spark", "assets/fx/spark-01.png");
    // this.load.image("fx-smoke", "assets/fx/smoke-01.png");
    //
    // Audio (when ready)
    // this.load.audio("sfx-place", "assets/audio/device-place.ogg");
    // this.load.audio("sfx-cable", "assets/audio/cable-connect.ogg");
    // this.load.audio("sfx-alert", "assets/audio/alert-fire.ogg");
  }

  create() {
    // Generate placeholder textures for any keys not yet loaded from files
    generateTextures(this);

    this.scene.start("WorldScene");
  }
}
