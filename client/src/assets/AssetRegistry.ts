/**
 * Asset registry — module-level singleton that holds loaded asset descriptors.
 *
 * Populated during PreloadScene.create() after Phaser finishes loading JSONs.
 * All game scenes read from this registry rather than hardcoding spatial metadata.
 *
 * Usage:
 *   // In PreloadScene.create():
 *   AssetRegistry.registerBackground(scene.cache.json.get('desc-bg-checkpoint'));
 *
 *   // In WorldScene / RackScene:
 *   const desc = AssetRegistry.getBackground('bg-checkpoint');
 */

import type {
  BackgroundDescriptor,
  DeviceDescriptor,
  RackDescriptor,
} from "./AssetDescriptors";

class _AssetRegistry {
  private readonly backgrounds = new Map<string, BackgroundDescriptor>();
  private readonly devices = new Map<string, DeviceDescriptor>();
  private readonly racks = new Map<string, RackDescriptor>();

  /**
   * Auto-detect descriptor type by shape and register it.
   * Called once per JSON entry in the Phaser cache — no manual routing needed.
   */
  register(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const d = data as Record<string, unknown>;
    if ("floorY" in d)    this.backgrounds.set(d.id as string, d as BackgroundDescriptor);
    else if ("portLayout" in d) this.devices.set(d.id as string, d as DeviceDescriptor);
    else if ("bay" in d)  this.racks.set(d.id as string, d as RackDescriptor);
  }

  /** Look up by descriptor id, e.g. "bg-checkpoint" */
  getBackground(id: string): BackgroundDescriptor | undefined {
    return this.backgrounds.get(id);
  }

  /** Look up by Device.model, e.g. "switch_24p" */
  getDevice(model: string): DeviceDescriptor | undefined {
    return this.devices.get(model);
  }

  /** Look up by rack descriptor id, e.g. "rack-42u" */
  getRack(id: string): RackDescriptor | undefined {
    return this.racks.get(id);
  }
}

export const AssetRegistry = new _AssetRegistry();
