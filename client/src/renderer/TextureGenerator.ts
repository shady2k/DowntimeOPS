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
  // Room / environment
  roomBg: 0x0d0d1a,
  floorLine: 0x1a1a2e,

  // Rack
  rackFrame: 0x3a3a4a,
  rackRail: 0x505068,
  rackInner: 0x1e1e30,
  rackBorder: 0x555570,
  rackScrew: 0x888898,
  slotLine: 0x2a2a3e,

  // Devices
  server: 0x1a6b42,
  serverFace: 0x22855a,
  switch: 0x1a5a8a,
  switchFace: 0x2278b0,
  router: 0x8a5a1a,
  routerFace: 0xb07828,
  firewall: 0x8a2a2a,
  firewallFace: 0xb03838,

  // Device states
  deviceIdle: 0x444460,
  deviceActive: 0x4a6a4a,
  deviceDegraded: 0x8a7a2a,
  deviceFailed: 0x8a2a2a,
  deviceSelected: 0xd4a820,

  // Ports / LEDs
  portUp: 0x30d060,
  portDown: 0xd04040,
  portErr: 0xd0a030,
  portOff: 0x404050,
  ledGlow: 0x40ff80,

  // Cables
  cable: 0x8855bb,
  cableCongested: 0xd0a030,
  cableCut: 0xd04040,

  // UI
  text: 0xecf0f1,
  textDim: 0x666680,
  highlight: 0xf1c40f,
  slotValid: 0x30d060,
  slotInvalid: 0xd04040,
} as const;

export function generateTextures(scene: Phaser.Scene): void {
  generateRoomBackground(scene);
  generateRackFrame(scene);
  generateDeviceTextures(scene);
  generatePortTextures(scene);
  generateSlotHighlights(scene);
}

function generateRoomBackground(scene: Phaser.Scene): void {
  const w = 1200;
  const h = 900;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Dark room gradient (top darker, bottom lighter)
  g.fillStyle(0x0a0a16, 1);
  g.fillRect(0, 0, w, h);

  // Floor area (bottom third)
  g.fillStyle(0x12121f, 1);
  g.fillRect(0, h * 0.7, w, h * 0.3);

  // Floor line
  g.lineStyle(2, 0x222240, 0.8);
  g.lineBetween(0, h * 0.7, w, h * 0.7);

  // Subtle floor tiles
  g.lineStyle(1, 0x1a1a30, 0.3);
  for (let x = 0; x < w; x += 60) {
    g.lineBetween(x, h * 0.7, x, h);
  }
  for (let y = Math.floor(h * 0.7); y < h; y += 40) {
    g.lineBetween(0, y, w, y);
  }

  // Ceiling pipes / cable trays
  g.lineStyle(3, 0x222238, 0.6);
  g.lineBetween(0, 30, w, 30);
  g.lineBetween(0, 35, w, 35);

  // Ambient overhead light pools
  g.fillStyle(0x1a1a30, 0.15);
  g.fillRect(200, 0, 200, h * 0.7);
  g.fillRect(600, 0, 200, h * 0.7);

  g.generateTexture("room-bg", w, h);
  g.destroy();
}

function generateRackFrame(scene: Phaser.Scene): void {
  const w = RACK.WIDTH;
  const h = RACK.HEIGHT + 40; // extra for top/bottom caps
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Rack shell — outer frame
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, 0, w, h, 4);

  // Inner cavity
  g.fillStyle(PALETTE.rackInner, 1);
  g.fillRect(RACK.RAIL_WIDTH, 20, RACK.INNER_WIDTH, RACK.HEIGHT);

  // Left rail
  g.fillStyle(PALETTE.rackRail, 1);
  g.fillRect(0, 20, RACK.RAIL_WIDTH, RACK.HEIGHT);

  // Right rail
  g.fillRect(w - RACK.RAIL_WIDTH, 20, RACK.RAIL_WIDTH, RACK.HEIGHT);

  // Rail depth shading (inner edges)
  g.fillStyle(0x2a2a3a, 0.5);
  g.fillRect(RACK.RAIL_WIDTH, 20, 3, RACK.HEIGHT);
  g.fillRect(w - RACK.RAIL_WIDTH - 3, 20, 3, RACK.HEIGHT);

  // Screw holes on rails (every 3U)
  for (let u = 0; u < RACK.TOTAL_U; u += 3) {
    const sy = 20 + u * RACK.SLOT_HEIGHT + RACK.SLOT_HEIGHT / 2;
    // Left rail screws
    g.fillStyle(PALETTE.rackScrew, 0.6);
    g.fillCircle(RACK.RAIL_WIDTH / 2, sy, 2.5);
    // Right rail screws
    g.fillCircle(w - RACK.RAIL_WIDTH / 2, sy, 2.5);
  }

  // Slot divider lines
  g.lineStyle(1, PALETTE.slotLine, 0.25);
  for (let u = 1; u <= RACK.TOTAL_U; u++) {
    const y = 20 + u * RACK.SLOT_HEIGHT;
    g.lineBetween(RACK.RAIL_WIDTH, y, w - RACK.RAIL_WIDTH, y);
  }

  // Top cap label area
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, 0, w, 20, { tl: 4, tr: 4, bl: 0, br: 0 });

  // Bottom cap
  g.fillStyle(PALETTE.rackFrame, 1);
  g.fillRoundedRect(0, h - 20, w, 20, { tl: 0, tr: 0, bl: 4, br: 4 });

  // Outer border
  g.lineStyle(2, PALETTE.rackBorder, 0.7);
  g.strokeRoundedRect(0, 0, w, h, 4);

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
    { key: "device-server", baseColor: PALETTE.server, faceColor: PALETTE.serverFace, uHeight: 1 },
    { key: "device-switch", baseColor: PALETTE.switch, faceColor: PALETTE.switchFace, uHeight: 1 },
    { key: "device-router", baseColor: PALETTE.router, faceColor: PALETTE.routerFace, uHeight: 1 },
    { key: "device-firewall", baseColor: PALETTE.firewall, faceColor: PALETTE.firewallFace, uHeight: 1 },
  ];

  for (const { key, baseColor, faceColor, uHeight } of types) {
    const w = RACK.INNER_WIDTH - 4;
    const h = uHeight * RACK.SLOT_HEIGHT - 2;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    // Device chassis
    g.fillStyle(baseColor, 1);
    g.fillRoundedRect(0, 0, w, h, 2);

    // Faceplate (lighter center area)
    g.fillStyle(faceColor, 1);
    g.fillRoundedRect(2, 2, w - 4, h - 4, 1);

    // Left mounting ear
    g.fillStyle(baseColor, 0.8);
    g.fillRect(0, 0, 6, h);

    // Right mounting ear
    g.fillRect(w - 6, 0, 6, h);

    // Mounting screw dots
    g.fillStyle(PALETTE.rackScrew, 0.5);
    g.fillCircle(3, h / 2, 1.5);
    g.fillCircle(w - 3, h / 2, 1.5);

    // Device-specific details
    if (key === "device-server") {
      // Fan grille (right side)
      g.lineStyle(1, baseColor, 0.6);
      for (let i = 0; i < 4; i++) {
        const fx = w - 30 + i * 5;
        g.lineBetween(fx, 3, fx, h - 3);
      }
      // Drive bays (small rectangles)
      g.fillStyle(0x111122, 0.5);
      for (let i = 0; i < 3; i++) {
        g.fillRect(80 + i * 14, 3, 10, h - 6);
      }
    } else if (key === "device-switch") {
      // Port block (row of small rectangles)
      g.fillStyle(0x111122, 0.4);
      g.fillRect(PORT.START_X - 6, 2, 24 * PORT.SPACING + 4, h - 4);
    } else if (key === "device-router") {
      // Ventilation grille (center)
      g.lineStyle(1, baseColor, 0.4);
      for (let i = 0; i < 6; i++) {
        const vx = w / 2 - 15 + i * 5;
        g.lineBetween(vx, 3, vx, h - 3);
      }
    } else if (key === "device-firewall") {
      // Shield icon placeholder (small diamond)
      g.fillStyle(0xdd4444, 0.3);
      const cx = w - 40;
      const cy = h / 2;
      g.fillTriangle(cx, cy - 4, cx - 4, cy, cx + 4, cy);
      g.fillTriangle(cx, cy + 4, cx - 4, cy, cx + 4, cy);
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  // State overlay textures (tinted overlays applied on top)
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
    g.fillRoundedRect(0, 0, w, h, 2);
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

  const size = PORT.RADIUS * 2 + 4; // padding for glow

  for (const { key, color } of portStates) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // Outer glow
    if (key === "port-up") {
      g.fillStyle(color, 0.15);
      g.fillCircle(cx, cy, PORT.RADIUS + 2);
    }

    // Port body (RJ45-ish rectangle)
    g.fillStyle(0x111122, 0.8);
    g.fillRect(cx - PORT.RADIUS, cy - PORT.RADIUS, PORT.RADIUS * 2, PORT.RADIUS * 2);

    // LED dot
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy - PORT.RADIUS + 2, 2);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  // Connected port overlay (white ring)
  const cg = scene.make.graphics({ x: 0, y: 0 }, false);
  cg.lineStyle(1.5, 0xffffff, 0.6);
  cg.strokeCircle(size / 2, size / 2, PORT.RADIUS);
  cg.generateTexture("port-connected", size, size);
  cg.destroy();
}

function generateSlotHighlights(scene: Phaser.Scene): void {
  const w = RACK.INNER_WIDTH - 4;
  const h = RACK.SLOT_HEIGHT - 2;

  // Valid placement ghost
  const gv = scene.make.graphics({ x: 0, y: 0 }, false);
  gv.fillStyle(PALETTE.slotValid, 0.15);
  gv.fillRoundedRect(0, 0, w, h, 2);
  gv.lineStyle(1, PALETTE.slotValid, 0.5);
  gv.strokeRoundedRect(0, 0, w, h, 2);
  gv.generateTexture("slot-valid", w, h);
  gv.destroy();

  // Invalid placement ghost
  const gi = scene.make.graphics({ x: 0, y: 0 }, false);
  gi.fillStyle(PALETTE.slotInvalid, 0.15);
  gi.fillRoundedRect(0, 0, w, h, 2);
  gi.lineStyle(1, PALETTE.slotInvalid, 0.5);
  gi.strokeRoundedRect(0, 0, w, h, 2);
  gi.generateTexture("slot-invalid", w, h);
  gi.destroy();

  // Hover highlight
  const gh = scene.make.graphics({ x: 0, y: 0 }, false);
  gh.fillStyle(0xffffff, 0.05);
  gh.fillRoundedRect(0, 0, w, h, 2);
  gh.generateTexture("slot-hover", w, h);
  gh.destroy();
}
