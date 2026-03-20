import Phaser from "phaser";
import { generateTextures } from "./TextureGenerator";

/**
 * Preload scene: generates placeholder textures and loads any file-based
 * assets before transitioning to the RackScene.
 *
 * When real art is ready, add this.load.image() / this.load.spritesheet()
 * calls in preload() using the same texture keys. The generated textures
 * will be overwritten by the loaded files automatically.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    // Future: load real assets here
    // this.load.image("room-bg", "assets/backgrounds/datacenter-room.png");
    // this.load.image("rack-frame", "assets/racks/rack-42u.png");
    // this.load.atlas("devices", "assets/devices/devices.png", "assets/devices/devices.json");
  }

  create() {
    // Generate placeholder textures for any keys not loaded from files
    generateTextures(this);

    this.scene.start("RackScene");
  }
}
