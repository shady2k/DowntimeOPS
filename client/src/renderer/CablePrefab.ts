/**
 * Cable visual prefab — defines how cables are drawn based on type and state.
 * Abstracts cable rendering so art swaps don't require scene changes.
 */

import { PALETTE } from "./TextureGenerator";

export interface CableStyle {
  color: number;
  width: number;
  alpha: number;
  shadowAlpha: number;
  sheenAlpha: number;
}

/** Compute cable visual style from link state */
export function getCableStyle(
  utilization: number,
  status: string,
  isHighlighted: boolean,
  time: number,
): CableStyle {
  if (isHighlighted) {
    return {
      color: PALETTE.highlight,
      width: 3,
      alpha: 1,
      shadowAlpha: 0.2,
      sheenAlpha: 0.1,
    };
  }

  if (status === "cut") {
    return {
      color: PALETTE.cableCut,
      width: 2.5,
      alpha: 0.8,
      shadowAlpha: 0.15,
      sheenAlpha: 0,
    };
  }

  if (utilization > 0.9) {
    // Congested — amber with pulse
    return {
      color: PALETTE.cableCongested,
      width: 3,
      alpha: 0.7 + Math.sin(time * 0.004) * 0.15,
      shadowAlpha: 0.15,
      sheenAlpha: 0.08,
    };
  }

  if (utilization > 0) {
    // Active
    return {
      color: PALETTE.cable,
      width: 2.5,
      alpha: 0.4 + utilization * 0.5,
      shadowAlpha: 0.1,
      sheenAlpha: 0.06,
    };
  }

  // Idle
  return {
    color: PALETTE.cable,
    width: 2,
    alpha: 0.2,
    shadowAlpha: 0,
    sheenAlpha: 0,
  };
}

/** Compute pulse color based on link utilization */
export function getPulseColor(utilization: number): number {
  if (utilization > 0.9) return PALETTE.cableCongested;
  if (utilization > 0.5) return 0x80b870;
  return PALETTE.portUp;
}

/**
 * Compute the L-shaped cable path segments.
 * Returns the exit X coordinate used for the vertical segment.
 */
export function getCableExitX(
  rackRight: number,
  yA: number,
  yB: number,
): number {
  return rackRight + 20 + Math.abs(yA - yB) * 0.25;
}

/**
 * Draw a cable path on a graphics object.
 * Three segments: horizontal out → vertical → horizontal back.
 */
export function drawCablePath(
  g: Phaser.GameObjects.Graphics,
  posA: { x: number; y: number },
  posB: { x: number; y: number },
  exitX: number,
  style: CableStyle,
) {
  // Shadow
  if (style.shadowAlpha > 0) {
    g.lineStyle(style.width + 1, 0x000000, style.shadowAlpha);
    g.beginPath();
    g.moveTo(posA.x + 1, posA.y + 1);
    g.lineTo(exitX + 1, posA.y + 1);
    g.lineTo(exitX + 1, posB.y + 1);
    g.lineTo(posB.x + 1, posB.y + 1);
    g.strokePath();
  }

  // Main cable
  g.lineStyle(style.width, style.color, style.alpha);
  g.beginPath();
  g.moveTo(posA.x, posA.y);
  g.lineTo(exitX, posA.y);
  g.lineTo(exitX, posB.y);
  g.lineTo(posB.x, posB.y);
  g.strokePath();

  // Sheen
  if (style.sheenAlpha > 0) {
    g.lineStyle(1, 0xffffff, style.sheenAlpha);
    g.beginPath();
    g.moveTo(posA.x, posA.y - 1);
    g.lineTo(exitX, posA.y - 1);
    g.strokePath();
  }

  // Endpoint dots
  g.fillStyle(style.color, style.alpha);
  g.fillCircle(posA.x, posA.y, 2.5);
  g.fillCircle(posB.x, posB.y, 2.5);
}

/**
 * Interpolate a position along a 3-segment cable path.
 * t ranges from 0 to 1.
 */
export function interpolateCablePath(
  posA: { x: number; y: number },
  posB: { x: number; y: number },
  exitX: number,
  t: number,
): { x: number; y: number } {
  const seg1Len = exitX - posA.x;
  const seg2Len = Math.abs(posB.y - posA.y);
  const seg3Len = exitX - posB.x;
  const totalLen = seg1Len + seg2Len + seg3Len;
  const dist = t * totalLen;

  if (dist <= seg1Len) {
    return { x: posA.x + dist, y: posA.y };
  } else if (dist <= seg1Len + seg2Len) {
    const segT = (dist - seg1Len) / seg2Len;
    return { x: exitX, y: posA.y + (posB.y - posA.y) * segT };
  } else {
    const segT = (dist - seg1Len - seg2Len) / seg3Len;
    return { x: exitX - segT * seg3Len, y: posB.y };
  }
}
