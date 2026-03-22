/**
 * Asset descriptor types.
 *
 * Each asset (background, device, rack) has a companion JSON file co-located
 * with its PNG. The JSON encodes spatial metadata in normalized 0–1 coordinates
 * so descriptors remain valid regardless of display scale or camera zoom.
 *
 * Naming: {asset-name}.json lives next to {asset-name}.png in the same folder.
 */

/** Background room descriptor — loaded from assets/backgrounds/{name}.json */
export interface BackgroundDescriptor {
  /** Matches the Phaser texture key used to load this background */
  id: string;
  /** Phaser texture key — may differ from id when rooms share art (e.g. office uses datacenter bg) */
  textureKey: string;
  /** Player floor Y as a fraction of GAME_H (multiply by GAME_H to get pixels) */
  floorY: number;
  /** Player sprite display height in pixels at 960×540 logical resolution */
  playerScale: number;
}

/** Port layout for devices with a uniform port grid (most rack equipment) */
export interface PortLayoutDescriptor {
  /** X of first port as a fraction of the device's rendered width */
  startX: number;
  /** Y center of port body row — used for hit zones and cabling highlights */
  startY: number;
  /**
   * Y of the per-port LED indicator row, as a fraction of device height.
   * Defaults to startY when omitted (LEDs sit at the port center).
   * Use a smaller value (e.g. 0.11) when LEDs sit above the port row.
   */
  ledY?: number;
  /** Maximum number of ports to show in rack view before showing overflow label */
  maxVisible: number;
}

/** Single indicator LED overlay position */
export interface LedDescriptor {
  id: string;
  /** X as a fraction of the device's rendered width */
  x: number;
  /** Y as a fraction of the device's rendered height */
  y: number;
}

/**
 * Device faceplate descriptor — loaded from assets/devices/{name}.json.
 * Describes how to lay out ports and LEDs on a rack-mounted device.
 */
export interface DeviceDescriptor {
  /** Device model key, e.g. "switch_24p", "server_1u" — matches Device.model */
  id: string;
  /** Phaser texture key */
  textureKey: string;
  /** Height in rack units */
  uHeight: number;
  /** Port row layout (uniform grid; override with per-port positions for real art) */
  portLayout: PortLayoutDescriptor;
  /** Main status LED position */
  statusLed: LedDescriptor;
}

/**
 * Rack frame descriptor — loaded from assets/racks/{name}.json.
 * Describes the inner bay area where devices are mounted.
 * All values are 0–1 fractions of the displayed rack image dimensions.
 */
export interface RackDescriptor {
  id: string;
  textureKey: string;
  totalU: number;
  /** Inner bay bounds as fractions of displayed rack image size */
  bay: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  /** U-number label X as a fraction of displayed rack image width (right-aligned to this X) */
  uLabelX: number;
}
