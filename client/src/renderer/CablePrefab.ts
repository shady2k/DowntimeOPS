/**
 * Cable visual prefab — renders realistic-looking network cables.
 *
 * Cables are drawn with multiple parallel strokes to simulate a 3D
 * cylindrical jacket: dark underside → body color → specular highlight.
 * RJ45 plugs are drawn at endpoints with housing, clip tab, and shading.
 *
 * World-space scale: 1U ≈ 10–12 px. Cable body ≈ 1.2 px wide.
 */

import type { CableType } from "@downtime-ops/shared";
import { PALETTE } from "./TextureGenerator";

export interface CableStyle {
  color: number;
  width: number;
  alpha: number;
}

// ── Cable type colors ────────────────────────────────────────

const CABLE_TYPE_COLORS: Record<CableType, number> = {
  cat6:      0x888888,  // gray
  cat6a:     0x999999,  // light gray
  om3_fiber: 0x777777,  // darker gray
  os2_fiber: 0x999999,  // light gray
};

/** Darker shade for shadow/underside of cable */
function darken(color: number, factor = 0.35): number {
  const r = ((color >> 16) & 0xff) * factor;
  const g = ((color >> 8) & 0xff) * factor;
  const b = (color & 0xff) * factor;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

/** Lighter shade for specular highlight */
function lighten(color: number, factor = 0.5): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * factor);
  const g = Math.min(255, ((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * factor);
  const b = Math.min(255, (color & 0xff) + (255 - (color & 0xff)) * factor);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

export function getCableTypeColor(type: CableType): number {
  return CABLE_TYPE_COLORS[type] ?? PALETTE.cable;
}

// ── Cable style from state ─────────────────────────────────────

export function getCableStyle(
  utilization: number,
  status: string,
  isHighlighted: boolean,
  _time: number,
  cableType?: CableType,
): CableStyle {
  const baseColor = cableType ? getCableTypeColor(cableType) : PALETTE.cable;

  if (isHighlighted) {
    return { color: PALETTE.highlight, width: 1.6, alpha: 1 };
  }
  if (status === "cut") {
    return { color: PALETTE.cableCut, width: 1.4, alpha: 1 };
  }
  if (utilization > 0.9) {
    return { color: PALETTE.cableCongested, width: 1.5, alpha: 1 };
  }
  if (utilization > 0) {
    return { color: baseColor, width: 1.3, alpha: 1 };
  }
  return { color: baseColor, width: 1.1, alpha: 1 };
}

export function getPulseColor(utilization: number): number {
  if (utilization > 0.9) return PALETTE.cableCongested;
  if (utilization > 0.5) return 0x80b870;
  return PALETTE.portUp;
}

// ── Bezier math ────────────────────────────────────────────────

function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

type Pt = { x: number; y: number };

function sampleBezier(a: Pt, cp1: Pt, cp2: Pt, b: Pt, segments: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push({
      x: bezier(a.x, cp1.x, cp2.x, b.x, t),
      y: bezier(a.y, cp1.y, cp2.y, b.y, t),
    });
  }
  return pts;
}

// ── Cable routing ──────────────────────────────────────────────

const CURVE_SEGMENTS = 28;

function routeCable(posA: Pt, posB: Pt, _bayRight: number) {
  const dy = Math.abs(posB.y - posA.y);
  // Cable loops out to the right of the rightmost port, proportional to vertical span
  const rightmostX = Math.max(posA.x, posB.x);
  const exitX = rightmostX + 4 + Math.min(dy * 0.15, 12);

  return {
    cp1: { x: exitX, y: posA.y + (posB.y - posA.y) * 0.25 },
    cp2: { x: exitX, y: posA.y + (posB.y - posA.y) * 0.75 },
  };
}

// ── Draw a realistic cable body (3-layer tube) ─────────────────

function drawTubePath(
  g: Phaser.GameObjects.Graphics,
  pts: Pt[],
  width: number,
  color: number,
  alpha: number,
) {
  const dark = darken(color);
  const bright = lighten(color, 0.45);

  // Layer 1: shadow/underside — widest, darkest, offset down
  g.lineStyle(width + 0.8, dark, alpha * 0.5);
  strokePts(g, pts, 0.2, 0.3);

  // Layer 2: cable jacket body
  g.lineStyle(width, color, alpha);
  strokePts(g, pts);

  // Layer 3: specular highlight — thin bright line offset up
  g.lineStyle(Math.max(0.3, width * 0.25), bright, alpha * 0.55);
  strokePts(g, pts, 0, -width * 0.25);
}

function strokePts(g: Phaser.GameObjects.Graphics, pts: Pt[], ox = 0, oy = 0) {
  g.beginPath();
  g.moveTo(pts[0].x + ox, pts[0].y + oy);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x + ox, pts[i].y + oy);
  }
  g.strokePath();
}

// ── RJ45 plug ──────────────────────────────────────────────────

/**
 * Draw an RJ45 plug inserted into a port.
 * Small and subtle — just enough to show the cable is plugged in.
 */
function drawRJ45(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number) {
  const dark = darken(color, 0.5);

  // Small plug face flush with the port — 1.4 × 1.0 world pixels
  g.fillStyle(dark, alpha);
  g.fillRect(x - 0.7, y - 0.5, 1.4, 1.0);

  // Tiny clip tab
  g.fillStyle(color, alpha * 0.7);
  g.fillRect(x - 0.3, y - 0.7, 0.6, 0.2);
}

// ── Public API ─────────────────────────────────────────────────

/** Interpolate a position along a cable for traffic pulses */
export function interpolateCablePath(posA: Pt, posB: Pt, rackRight: number, t: number): Pt {
  const { cp1, cp2 } = routeCable(posA, posB, rackRight);
  return {
    x: bezier(posA.x, cp1.x, cp2.x, posB.x, t),
    y: bezier(posA.y, cp1.y, cp2.y, posB.y, t),
  };
}

/** Draw a connected cable between two ports */
export function drawCablePath(
  g: Phaser.GameObjects.Graphics,
  posA: Pt,
  posB: Pt,
  rackRight: number,
  style: CableStyle,
) {
  const { cp1, cp2 } = routeCable(posA, posB, rackRight);
  const pts = sampleBezier(posA, cp1, cp2, posB, CURVE_SEGMENTS);

  drawTubePath(g, pts, style.width, style.color, style.alpha);

  // Plugs
  drawRJ45(g, posA.x, posA.y, style.color, style.alpha);
  drawRJ45(g, posB.x, posB.y, style.color, style.alpha);
}

/** Draw cable preview from source port to mouse cursor */
export function drawCablePreview(
  g: Phaser.GameObjects.Graphics,
  sourcePos: Pt,
  mouseX: number,
  mouseY: number,
  _rackRight: number,
  time: number,
  cableType?: CableType,
) {
  const color = cableType ? getCableTypeColor(cableType) : PALETTE.highlight;
  const pulse = 0.6 + Math.sin(time * 0.005) * 0.12;
  const target: Pt = { x: mouseX, y: mouseY };

  // Cable sags naturally between source and cursor
  const dx = mouseX - sourcePos.x;
  const dy = mouseY - sourcePos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(dist * 0.12, 20);
  const lowestY = Math.max(sourcePos.y, mouseY) + sag;

  const cp1: Pt = { x: sourcePos.x + Math.max(dx * 0.3, 6), y: lowestY };
  const cp2: Pt = { x: mouseX - Math.max(dx * 0.3, 4), y: lowestY };

  const pts = sampleBezier(sourcePos, cp1, cp2, target, 22);

  drawTubePath(g, pts, 1.2, color, pulse);

  // Plug at source
  drawRJ45(g, sourcePos.x, sourcePos.y, color, 0.9);

  // Dangling connector at mouse
  drawRJ45(g, mouseX, mouseY, color, 0.75);

  // Subtle glow pulse at source port
  g.fillStyle(color, pulse * 0.12);
  g.fillCircle(sourcePos.x, sourcePos.y, 1.8);
}
