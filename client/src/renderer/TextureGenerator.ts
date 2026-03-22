/**
 * Generates placeholder sprite textures at runtime.
 * These are swappable — replace with real art assets later by loading
 * images with the same keys in PreloadScene.
 */

// Rack layout constants (shared across renderer)
export const RACK = {
  WIDTH: 460,
  TOTAL_U: 42,
  SLOT_HEIGHT: 20,
  RAIL_WIDTH: 18,
  get HEIGHT() {
    return this.TOTAL_U * this.SLOT_HEIGHT;
  },
  get INNER_WIDTH() {
    return this.WIDTH - this.RAIL_WIDTH * 2;
  },
} as const;

export const PORT = {
  RADIUS: 5,
  SPACING: 16,
  HIT_RADIUS: 12, // oversized invisible hit area
  START_X: 140,
} as const;

export const PALETTE = {
  // Room / environment — warm browns
  roomBg: 0x1e1814,
  roomWall: 0x2a2218,
  floorLine: 0x3a3020,

  // Rack — warm gunmetal
  rackFrame: 0x4a4240,
  rackRail: 0x5a5450,
  rackInner: 0x2e2520,
  rackBorder: 0x6a6058,
  rackScrew: 0xa89070,
  slotLine: 0x3a3028,

  // Devices — warm muted tones
  server: 0x3a6a40,
  serverFace: 0x4a8a55,
  switch: 0x3a6a8a,
  switchFace: 0x4a88aa,
  router: 0x9a6a2a,
  routerFace: 0xb88838,
  firewall: 0x8a3a30,
  firewallFace: 0xa84840,

  // Device states
  deviceIdle: 0x504840,
  deviceActive: 0x4a5a3a,
  deviceDegraded: 0x8a7030,
  deviceFailed: 0x8a3028,
  deviceSelected: 0xe8a840,

  // Ports / LEDs — softer tones
  portUp: 0x60c070,
  portDown: 0xd45a4a,
  portErr: 0xd4a040,
  portOff: 0x504840,
  ledGlow: 0x70d088,

  // Cables — warm purple-brown
  cable: 0x8a6688,
  cableCongested: 0xd4a040,
  cableCut: 0xd45a4a,

  // UI
  text: 0xf0e0cc,
  textDim: 0x706050,
  highlight: 0xe8a840,
  slotValid: 0x60c070,
  slotInvalid: 0xd45a4a,
} as const;

/** Phaser-compatible hex strings for text styles */
export const TEXT_COLORS = {
  primary: "#f0e0cc",
  muted: "#a08a70",
  dim: "#706050",
  accent: "#e8a840",
  success: "#7ab87a",
  danger: "#d4675a",
  heading: "#c0a888",
} as const;

export function generateTextures(scene: Phaser.Scene): void {
  generateRoomBackground(scene);
  generateRackFrame(scene);
  generateDeviceTextures(scene);
  generatePortTextures(scene);
  generateSlotHighlights(scene);
  generateWorldSprites(scene);
}

function generateRoomBackground(scene: Phaser.Scene): void {
  const w = 1200;
  const h = 900;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Warm dark room
  g.fillStyle(0x1a1410, 1);
  g.fillRect(0, 0, w, h);

  // Wall area (upper portion) — subtle warm gradient
  g.fillStyle(0x221c16, 1);
  g.fillRect(0, 0, w, h * 0.68);

  // Wall texture — subtle horizontal stripes (concrete blocks)
  g.lineStyle(1, 0x2a2418, 0.3);
  for (let y = 0; y < h * 0.68; y += 32) {
    g.lineBetween(0, y, w, y);
  }
  // Vertical joints (staggered brick pattern)
  for (let row = 0; row < h * 0.68 / 32; row++) {
    const offset = row % 2 === 0 ? 0 : 60;
    for (let x = offset; x < w; x += 120) {
      g.lineBetween(x, row * 32, x, (row + 1) * 32);
    }
  }

  // Floor area — dark warm concrete
  g.fillStyle(0x28201a, 1);
  g.fillRect(0, h * 0.68, w, h * 0.32);

  // Floor/wall boundary line
  g.lineStyle(2, 0x3a3028, 0.8);
  g.lineBetween(0, h * 0.68, w, h * 0.68);

  // Floor tiles (raised floor pattern)
  g.lineStyle(1, 0x322a22, 0.25);
  for (let x = 0; x < w; x += 60) {
    g.lineBetween(x, h * 0.68, x, h);
  }
  for (let y = Math.floor(h * 0.68); y < h; y += 40) {
    g.lineBetween(0, y, w, y);
  }

  // Ceiling cable trays — warm wooden beams
  g.fillStyle(0x3a3020, 0.6);
  g.fillRect(0, 28, w, 8);
  g.fillRect(0, 44, w, 4);
  // Beam shadow
  g.lineStyle(1, 0x140e0a, 0.3);
  g.lineBetween(0, 36, w, 36);

  // Warm overhead light pools
  g.fillStyle(0x3a2a18, 0.12);
  g.fillRect(180, 0, 240, h * 0.68);
  g.fillRect(580, 0, 240, h * 0.68);

  // Warm light cone from above (center)
  g.fillStyle(0x4a3a20, 0.06);
  g.fillRect(300, 0, 180, h * 0.7);

  // Vignette effect — dark corners
  g.fillStyle(0x0a0806, 0.2);
  g.fillRect(0, 0, 80, h);
  g.fillRect(w - 80, 0, 80, h);

  // Wall decoration hints — small poster rectangles
  g.fillStyle(0x2e2620, 0.4);
  g.fillRoundedRect(80, 120, 48, 36, 2);
  g.fillRoundedRect(900, 140, 56, 40, 2);
  // Poster highlight
  g.lineStyle(1, 0x3a3228, 0.3);
  g.strokeRoundedRect(80, 120, 48, 36, 2);
  g.strokeRoundedRect(900, 140, 56, 40, 2);

  g.generateTexture("room-bg", w, h);
  g.destroy();
}

function generateRackFrame(scene: Phaser.Scene): void {
  const w = RACK.WIDTH;
  const h = RACK.HEIGHT + 40; // extra for top/bottom caps
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Rack shell — outer frame with warm gunmetal
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, 0, w, h, 6);

  // Subtle top highlight (light catching)
  g.fillStyle(0x5a5450, 0.3);
  g.fillRect(4, 2, w - 8, 2);

  // Inner cavity — dark warm
  g.fillStyle(PALETTE.rackInner, 1);
  g.fillRect(RACK.RAIL_WIDTH, 20, RACK.INNER_WIDTH, RACK.HEIGHT);

  // Left rail
  g.fillStyle(PALETTE.rackRail, 1);
  g.fillRect(0, 20, RACK.RAIL_WIDTH, RACK.HEIGHT);

  // Right rail
  g.fillRect(w - RACK.RAIL_WIDTH, 20, RACK.RAIL_WIDTH, RACK.HEIGHT);

  // Rail inner edge depth shading
  g.fillStyle(0x3a3028, 0.5);
  g.fillRect(RACK.RAIL_WIDTH, 20, 3, RACK.HEIGHT);
  g.fillRect(w - RACK.RAIL_WIDTH - 3, 20, 3, RACK.HEIGHT);

  // Screw holes on rails (every 3U) — brass/copper color
  for (let u = 0; u < RACK.TOTAL_U; u += 3) {
    const sy = 20 + u * RACK.SLOT_HEIGHT + RACK.SLOT_HEIGHT / 2;
    // Left rail screws
    g.fillStyle(PALETTE.rackScrew, 0.7);
    g.fillCircle(RACK.RAIL_WIDTH / 2, sy, 2.5);
    g.fillStyle(0xc0a880, 0.3); // highlight pip
    g.fillCircle(RACK.RAIL_WIDTH / 2 - 0.5, sy - 0.5, 1);
    // Right rail screws
    g.fillStyle(PALETTE.rackScrew, 0.7);
    g.fillCircle(w - RACK.RAIL_WIDTH / 2, sy, 2.5);
    g.fillStyle(0xc0a880, 0.3);
    g.fillCircle(w - RACK.RAIL_WIDTH / 2 - 0.5, sy - 0.5, 1);
  }

  // Slot divider lines — subtle warm
  g.lineStyle(1, PALETTE.slotLine, 0.2);
  for (let u = 1; u <= RACK.TOTAL_U; u++) {
    const y = 20 + u * RACK.SLOT_HEIGHT;
    g.lineBetween(RACK.RAIL_WIDTH, y, w - RACK.RAIL_WIDTH, y);
  }

  // Top cap with label area
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, 0, w, 20, { tl: 6, tr: 6, bl: 0, br: 0 });

  // Bottom cap
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, h - 20, w, 20, { tl: 0, tr: 0, bl: 6, br: 6 });

  // Outer border — warm accent
  g.lineStyle(2, PALETTE.rackBorder, 0.6);
  g.strokeRoundedRect(0, 0, w, h, 6);

  g.generateTexture("rack-frame", w, h);
  g.destroy();
}

function generateDeviceTextures(scene: Phaser.Scene): void {
  const types: Array<{
    key: string;
    baseColor: number;
    faceColor: number;
    uHeight: number;
  }> = [
    { key: "device-server",   baseColor: PALETTE.server,   faceColor: PALETTE.serverFace,   uHeight: 1 },
    { key: "device-switch",   baseColor: PALETTE.switch,   faceColor: PALETTE.switchFace,   uHeight: 1 },
    { key: "device-router",   baseColor: PALETTE.router,   faceColor: PALETTE.routerFace,   uHeight: 1 },
    { key: "device-firewall", baseColor: PALETTE.firewall, faceColor: PALETTE.firewallFace, uHeight: 1 },
  ];

  for (const { key, baseColor, faceColor, uHeight } of types) {
    // SVG or real PNG already loaded — skip
    if (scene.textures.exists(key)) continue;

    // Nothing loaded — generate with Graphics as last resort
    const w = RACK.INNER_WIDTH - 4;
    const h = uHeight * RACK.SLOT_HEIGHT - 2;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    // Device chassis
    g.fillStyle(baseColor, 1);
    g.fillRoundedRect(0, 0, w, h, 3);

    // Faceplate (lighter center area)
    g.fillStyle(faceColor, 1);
    g.fillRoundedRect(2, 2, w - 4, h - 4, 2);

    // Top edge light catch
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(3, 2, w - 6, 1);

    // Bottom edge shadow
    g.fillStyle(0x000000, 0.12);
    g.fillRect(3, h - 2, w - 6, 1);

    // Left mounting ear
    g.fillStyle(baseColor, 0.9);
    g.fillRect(0, 0, 8, h);

    // Right mounting ear
    g.fillRect(w - 8, 0, 8, h);

    // Mounting screw dots — brass
    g.fillStyle(PALETTE.rackScrew, 0.6);
    g.fillCircle(4, h / 2, 1.5);
    g.fillCircle(w - 4, h / 2, 1.5);

    // Device-specific details
    if (key === "device-server") {
      // Fan grille (right side)
      g.lineStyle(1, baseColor, 0.5);
      for (let i = 0; i < 4; i++) {
        const fx = w - 32 + i * 5;
        g.lineBetween(fx, 3, fx, h - 3);
      }
      // Drive bays
      g.fillStyle(0x1a1410, 0.4);
      for (let i = 0; i < 3; i++) {
        g.fillRect(80 + i * 14, 3, 10, h - 6);
      }
    } else if (key === "device-switch") {
      // Port block
      g.fillStyle(0x1a1410, 0.35);
      g.fillRect(PORT.START_X - 6, 2, 24 * PORT.SPACING + 4, h - 4);
    } else if (key === "device-router") {
      // Ventilation grille (center)
      g.lineStyle(1, baseColor, 0.35);
      for (let i = 0; i < 6; i++) {
        const vx = w / 2 - 15 + i * 5;
        g.lineBetween(vx, 3, vx, h - 3);
      }
    } else if (key === "device-firewall") {
      // Shield icon placeholder
      g.fillStyle(0xdd5544, 0.25);
      const cx = w - 40;
      const cy = h / 2;
      g.fillTriangle(cx, cy - 4, cx - 4, cy, cx + 4, cy);
      g.fillTriangle(cx, cy + 4, cx - 4, cy, cx + 4, cy);
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  // State overlay textures
  const overlays: Array<{ key: string; color: number; alpha: number }> = [
    { key: "overlay-selected", color: PALETTE.deviceSelected, alpha: 0.15 },
    { key: "overlay-degraded", color: PALETTE.deviceDegraded, alpha: 0.2 },
    { key: "overlay-failed", color: PALETTE.deviceFailed, alpha: 0.25 },
    { key: "overlay-active", color: PALETTE.deviceActive, alpha: 0.1 },
  ];

  for (const { key, color, alpha } of overlays) {
    const w = RACK.INNER_WIDTH - 4;
    const h = RACK.SLOT_HEIGHT - 2;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(0, 0, w, h, 3);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}

function generatePortTextures(scene: Phaser.Scene): void {
  const portStates: Array<{ key: string; color: number }> = [
    { key: "port-up", color: PALETTE.portUp },
    { key: "port-down", color: PALETTE.portDown },
    { key: "port-err", color: PALETTE.portErr },
    { key: "port-off", color: PALETTE.portOff },
  ];

  const size = PORT.RADIUS * 2 + 4;

  for (const { key, color } of portStates) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // Outer glow
    if (key === "port-up") {
      g.fillStyle(color, 0.05);
      g.fillCircle(cx, cy, PORT.RADIUS + 2);
    }

    // Port body (RJ45-ish rectangle)
    g.fillStyle(0x1a1410, 0.7);
    g.fillRect(cx - PORT.RADIUS, cy - PORT.RADIUS, PORT.RADIUS * 2, PORT.RADIUS * 2);

    // LED dot
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy - PORT.RADIUS + 2, 2);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  // Connected port overlay (warm white ring)
  const cg = scene.make.graphics({ x: 0, y: 0 }, false);
  cg.lineStyle(1.5, 0xf0e0cc, 0.5);
  cg.strokeCircle(size / 2, size / 2, PORT.RADIUS);
  cg.generateTexture("port-connected", size, size);
  cg.destroy();
}

function generateSlotHighlights(scene: Phaser.Scene): void {
  const w = RACK.INNER_WIDTH - 4;
  const h = RACK.SLOT_HEIGHT - 2;

  // Valid placement ghost
  const gv = scene.make.graphics({ x: 0, y: 0 }, false);
  gv.fillStyle(PALETTE.slotValid, 0.12);
  gv.fillRoundedRect(0, 0, w, h, 3);
  gv.lineStyle(1, PALETTE.slotValid, 0.4);
  gv.strokeRoundedRect(0, 0, w, h, 3);
  gv.generateTexture("slot-valid", w, h);
  gv.destroy();

  // Invalid placement ghost
  const gi = scene.make.graphics({ x: 0, y: 0 }, false);
  gi.fillStyle(PALETTE.slotInvalid, 0.12);
  gi.fillRoundedRect(0, 0, w, h, 3);
  gi.lineStyle(1, PALETTE.slotInvalid, 0.4);
  gi.strokeRoundedRect(0, 0, w, h, 3);
  gi.generateTexture("slot-invalid", w, h);
  gi.destroy();

  // Hover highlight
  const gh = scene.make.graphics({ x: 0, y: 0 }, false);
  gh.fillStyle(0xf0e0cc, 0.04);
  gh.fillRoundedRect(0, 0, w, h, 3);
  gh.generateTexture("slot-hover", w, h);
  gh.destroy();
}

function generateWorldSprites(scene: Phaser.Scene): void {
  generatePackageBox(scene);
  generateWorldRack(scene);
  generatePlacementZone(scene);
}

function generatePackageBox(scene: Phaser.Scene): void {
  const w = 60;
  const h = 50;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Box body — warm cardboard brown
  g.fillStyle(0x8a6a40, 1);
  g.fillRoundedRect(0, 6, w, h - 6, 3);

  // Top flaps (closed box top)
  g.fillStyle(0x9a7a50, 1);
  g.fillRoundedRect(0, 0, w, 12, { tl: 3, tr: 3, bl: 0, br: 0 });

  // Flap crease line
  g.lineStyle(1, 0x6a5030, 0.6);
  g.lineBetween(w / 2, 0, w / 2, 12);

  // Top edge highlight
  g.fillStyle(0xb08a58, 0.4);
  g.fillRect(2, 1, w - 4, 1);

  // Bottom shadow
  g.fillStyle(0x000000, 0.15);
  g.fillRect(2, h - 3, w - 4, 2);

  // Packing tape — horizontal strip
  g.fillStyle(0xc0a060, 0.5);
  g.fillRect(4, 10, w - 8, 6);

  // Packing tape — vertical strip
  g.fillStyle(0xc0a060, 0.4);
  g.fillRect(w / 2 - 4, 0, 8, h);

  // Shipping label
  g.fillStyle(0xf0e8d0, 0.8);
  g.fillRect(8, 22, 24, 16);
  // Label lines (fake text)
  g.lineStyle(1, 0x8a7a60, 0.5);
  g.lineBetween(10, 26, 28, 26);
  g.lineBetween(10, 30, 24, 30);
  g.lineBetween(10, 34, 20, 34);

  // Side edge shading
  g.fillStyle(0x000000, 0.08);
  g.fillRect(w - 6, 6, 6, h - 9);

  g.generateTexture("package-box", w, h);
  g.destroy();
}

function generateWorldRack(scene: Phaser.Scene): void {
  // Smaller rack for world view (not the detailed 42U close-up)
  const w = 48;
  const h = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Rack body — dark gunmetal
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, 0, w, h, 4);

  // Inner cavity
  g.fillStyle(PALETTE.rackInner, 1);
  g.fillRect(4, 4, w - 8, h - 8);

  // Rails
  g.fillStyle(PALETTE.rackRail, 1);
  g.fillRect(0, 4, 4, h - 8);
  g.fillRect(w - 4, 4, 4, h - 8);

  // Slot lines (simplified — every ~6U)
  g.lineStyle(1, PALETTE.slotLine, 0.3);
  const slotCount = 7;
  for (let i = 1; i < slotCount; i++) {
    const y = 4 + i * ((h - 8) / slotCount);
    g.lineBetween(4, y, w - 4, y);
  }

  // Screw dots on rails
  g.fillStyle(PALETTE.rackScrew, 0.6);
  for (let i = 0; i < 3; i++) {
    const y = 16 + i * 24;
    g.fillCircle(2, y, 1.5);
    g.fillCircle(w - 2, y, 1.5);
  }

  // Top/bottom caps
  g.fillStyle(PALETTE.rackBorder, 0.5);
  g.fillRect(0, 0, w, 4);
  g.fillRect(0, h - 4, w, 4);

  // Outer border
  g.lineStyle(1, PALETTE.rackBorder, 0.6);
  g.strokeRoundedRect(0, 0, w, h, 4);

  // Subtle LED dots (a couple of active devices)
  g.fillStyle(PALETTE.portUp, 0.6);
  g.fillCircle(8, 14, 1.5);
  g.fillCircle(8, 26, 1.5);
  g.fillStyle(PALETTE.portOff, 0.4);
  g.fillCircle(8, 38, 1.5);

  g.generateTexture("rack-world", w, h);
  g.destroy();
}

function generatePlacementZone(scene: Phaser.Scene): void {
  const w = 56;
  const h = 88;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Dashed border rectangle
  g.lineStyle(2, PALETTE.slotValid, 0.4);
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 4);

  // Corner brackets for emphasis
  const bracketLen = 10;
  g.lineStyle(2, PALETTE.slotValid, 0.7);
  // Top-left
  g.lineBetween(2, 2, 2 + bracketLen, 2);
  g.lineBetween(2, 2, 2, 2 + bracketLen);
  // Top-right
  g.lineBetween(w - 2, 2, w - 2 - bracketLen, 2);
  g.lineBetween(w - 2, 2, w - 2, 2 + bracketLen);
  // Bottom-left
  g.lineBetween(2, h - 2, 2 + bracketLen, h - 2);
  g.lineBetween(2, h - 2, 2, h - 2 - bracketLen);
  // Bottom-right
  g.lineBetween(w - 2, h - 2, w - 2 - bracketLen, h - 2);
  g.lineBetween(w - 2, h - 2, w - 2, h - 2 - bracketLen);

  // Subtle fill
  g.fillStyle(PALETTE.slotValid, 0.06);
  g.fillRoundedRect(2, 2, w - 4, h - 4, 4);

  g.generateTexture("placement-zone", w, h);
  g.destroy();
}

