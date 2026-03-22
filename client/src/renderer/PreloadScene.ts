import Phaser from "phaser";
import { generateTextures } from "./TextureGenerator";
import { AssetRegistry } from "../assets/AssetRegistry";
import { DEVICE_SVG_BUILDERS } from "./SvgDeviceGenerator";

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
    // img() loads the PNG and its co-located .json descriptor in one call.
    // Phaser keeps textures and JSON in separate caches — same key, no collision.
    const img = (key: string, path: string) => {
      this.load.image(key, path);
      this.load.json(key, path.replace(/\.[^.]+$/, ".json"));
    };

    // Backgrounds
    img("bg-checkpoint", "assets/backgrounds/checkpoint.png");
    img("bg-yard",       "assets/backgrounds/yard.png");
    img("bg-storage",    "assets/backgrounds/storage.png");
    img("bg-datacenter", "assets/backgrounds/datacenter-interior.png");
    // Office shares the datacenter image but has its own floorY/playerScale descriptor
    this.load.json("bg-office", "assets/backgrounds/office.json");

    // Rack
    img("rack-empty", "assets/racks/rack-42u-empty.png");

    // Devices — SVG faceplates loaded directly under the main key.
    // Phaser natively scales SVG textures; no canvas copy needed.
    // To ship real art: remove the svg() call for that key and add img() instead.
    const deviceFiles: Record<string, string> = {
      "device-server":   "device-server-1u",
      "device-switch":   "device-switch-24p",
      "device-router":   "device-router-1u",
      "device-firewall": "device-firewall-1u",
    };
    for (const [key, build] of Object.entries(DEVICE_SVG_BUILDERS)) {
      const dataUrl = `data:image/svg+xml;base64,${btoa(build())}`;
      this.load.svg(key, dataUrl, { width: 420, height: 18 });
      // Descriptor JSON — different Phaser cache, same key is fine
      this.load.json(key, `assets/devices/${deviceFiles[key]}.json`);
    }

    // Player — single spritesheet: frame 0 = idle, frames 1-8 = walk
    this.load.spritesheet("player-walk", "assets/player/player-walk.png", {
      frameWidth: 580,
      frameHeight: 940,
    });

    // UI
    this.load.image("ui-panel-bg",   "assets/ui/panel-bg.png");
    this.load.image("ui-shelf-tray", "assets/ui/shelf-tray.png");
    this.load.image("ui-logo",       "assets/ui/logo.png");

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
    // Register every loaded JSON descriptor. AssetRegistry.register() auto-detects
    // type by shape — no manual routing needed when new assets are added.
    for (const key of this.cache.json.getKeys()) {
      AssetRegistry.register(this.cache.json.get(key));
    }

    // Generate placeholder textures for any keys not yet loaded from files
    generateTextures(this);

    this.scene.start("WorldScene");
  }
}
