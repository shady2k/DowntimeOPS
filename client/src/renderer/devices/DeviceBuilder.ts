/**
 * Shared SVG primitives for 1U rack device faceplates.
 *
 * Canvas coordinate system: 420×18px (1U canonical).
 * Rasterised at 4× = 1680×72 by Phaser's SVG loader.
 *
 * Regions:
 *   x   0-12   left mounting ear
 *   x  14-75   label plate  (model name + LED socket at x=65)
 *   x  78-405  content area (ports, buttons, vents…)
 *   x 408-420  right mounting ear
 *
 * The status LED socket at x=LED_SLOT_X corresponds to statusLed.x ≈ 0.155
 * in the device JSON descriptor. RackScene draws the live status LED on top.
 */

export const SVG_W = 420;
export const SVG_H = 18;

/** SVG x of the status LED socket. Must equal statusLed.x × SVG_W in JSON. */
export const LED_SLOT_X = 65;

// ── Structural ────────────────────────────────────────────────

/** Rack mounting ear with screw hole. x = left edge of the 12px ear. */
export function ear(x: number): string {
  const cx = x + 6;
  return `
    <rect x="${x}" y="0" width="12" height="${SVG_H}" fill="#0c1216"/>
    <circle cx="${cx}" cy="${SVG_H / 2}" r="2.5" fill="#07090e"/>
    <circle cx="${cx}" cy="${SVG_H / 2}" r="1" fill="#28384a"/>`;
}

/**
 * Model label plate. Occupies x 14-75.
 * No LED art baked in — Phaser renders the live status LED from the descriptor.
 */
export function label(text: string, color: string): string {
  return `
    <rect x="14" y="2" width="58" height="14" fill="rgba(0,0,0,0.35)" rx="1"/>
    <text x="17" y="12" font-size="6" fill="${color}" font-family="monospace" font-weight="bold">${text}</text>`;
}

// ── Port sockets ──────────────────────────────────────────────

/** RJ45 port socket. x/y = top-left corner; w×h = outer bezel. */
export function rj45(x: number, y: number, w = 14, h = 10): string {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#050a10" rx="1"/>
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="#020508" rx="0.5"/>
    <rect x="${x + 2}" y="${y + 1}" width="${w - 4}" height="1" fill="rgba(255,255,255,0.05)"/>
    <rect x="${x + 2}" y="${y + h - 3}" width="${w - 4}" height="1.5" fill="#08101c"/>`;
}

/** Console/management RJ45 — narrower, with "CON" label below. */
export function consolePort(x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="12" height="9" fill="#040608" rx="1"/>
    <rect x="${x + 1}" y="${y + 1}" width="10" height="7" fill="#020408" rx="0.5"/>
    <rect x="${x + 2}" y="${y + 1}" width="8" height="1" fill="rgba(255,255,255,0.04)"/>
    <rect x="${x + 3}" y="${y + 3}" width="6" height="3" fill="#030507"/>
    <text x="${x}" y="${SVG_H - 1}" font-size="3" fill="rgba(160,130,80,0.6)" font-family="monospace">CON</text>`;
}

/** SFP / SFP+ transceiver cage. */
export function sfp(x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="14" height="11" fill="#040608" rx="1"/>
    <rect x="${x + 1}" y="${y + 1}" width="12" height="9" fill="#020408" rx="0.5"/>
    <rect x="${x + 2}" y="${y + 1}" width="10" height="1" fill="rgba(255,255,255,0.04)"/>
    <rect x="${x + 2}" y="${y + 4}" width="10" height="4" fill="#030507"/>`;
}

/** USB-A port. */
export function usb(x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="9" height="7" fill="#040608" rx="0.5"/>
    <rect x="${x + 1}" y="${y + 1}" width="7" height="5" fill="#020408"/>
    <rect x="${x + 2}" y="${y + 1}" width="5" height="1" fill="rgba(255,255,255,0.07)"/>`;
}

// ── Chassis decoration ────────────────────────────────────────

/**
 * Horizontal vent slot panel. Fills x … x+width of the body with
 * three subtle shadow slots — makes right-side empty chassis readable.
 */
export function vents(x: number, width: number): string {
  const slotYs = [4, 8, 13] as const;
  let out = `<rect x="${x}" y="2" width="${width}" height="14" fill="rgba(0,0,0,0.12)" rx="1"/>`;
  for (const sy of slotYs) {
    out += `<rect x="${x + 2}" y="${sy}" width="${width - 4}" height="1" fill="rgba(0,0,0,0.35)"/>`;
  }
  return out;
}

// ── SVG wrapper ───────────────────────────────────────────────

/** Wrap content in a full SVG document with standard chassis chrome. */
export function svgDoc(bgColor: string, content: string, extraStripes = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}">
  <rect width="${SVG_W}" height="${SVG_H}" fill="${bgColor}" rx="2"/>
  ${extraStripes}
  <rect width="${SVG_W}" height="1" fill="rgba(255,255,255,0.06)"/>
  <rect y="${SVG_H - 1}" width="${SVG_W}" height="1" fill="rgba(0,0,0,0.4)"/>
  ${ear(0)}
  ${ear(408)}
  ${content}
</svg>`;
}
