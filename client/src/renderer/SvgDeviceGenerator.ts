/**
 * SVG device faceplate generator.
 *
 * Each function returns an SVG string at 420×18px (1U canonical size).
 * These are loaded as Phaser textures via data URLs in PreloadScene.
 * If a real PNG is loaded for the same key, it takes priority.
 *
 * Design rules:
 * - Left/right mounting ears with screw holes
 * - Model label on left
 * - Port row in center
 * - Status LED on far right
 * - Colors match PALETTE in TextureGenerator
 */

const W = 420;
const H = 18;

function ear(x: number): string {
  const cx = x < W / 2 ? x + 6 : x + 6;
  return `
    <rect x="${x}" y="0" width="12" height="${H}" fill="#0e1418"/>
    <circle cx="${cx}" cy="9" r="2.5" fill="#080c10"/>
    <circle cx="${cx}" cy="9" r="1" fill="#2a3a48"/>`;
}

function label(text: string, color: string): string {
  return `
    <rect x="14" y="2" width="58" height="14" fill="rgba(0,0,0,0.3)" rx="1"/>
    <text x="17" y="12" font-size="6" fill="${color}" font-family="monospace" font-weight="bold">${text}</text>`;
}

function statusLed(color: string, glow: string): string {
  return `
    <circle cx="406" cy="9" r="3" fill="${color}"/>
    <circle cx="406" cy="9" r="1.5" fill="${glow}" opacity="0.8"/>`;
}

function rj45Port(x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="20" height="6" fill="#06090c" rx="1"/>
    <rect x="${x + 1}" y="${y + 1}" width="18" height="1" fill="rgba(255,255,255,0.07)"/>
    <rect x="${x + 3}" y="${y + 2}" width="14" height="3" fill="#0a0e12"/>`;
}

function sfpPort(x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="14" height="10" fill="#06090c" rx="1"/>
    <rect x="${x + 2}" y="${y + 2}" width="10" height="6" fill="#0a0e12" rx="1"/>
    <rect x="${x + 1}" y="${y + 1}" width="12" height="1" fill="rgba(255,255,255,0.07)"/>`;
}

/** 24-port switch faceplate */
export function buildSwitchSvg(): string {
  const portStartX = 76;
  const portW = 20;
  const portGap = 3;
  const stride = portW + portGap;

  let ports = '';
  // Two rows of 12 ports
  for (let i = 0; i < 12; i++) {
    const px = portStartX + i * stride;
    ports += rj45Port(px, 3);
    ports += rj45Port(px, 10);
  }

  // Activity LEDs above each port pair
  let leds = '';
  for (let i = 0; i < 12; i++) {
    const lx = portStartX + i * stride + portW / 2;
    leds += `<circle cx="${lx}" cy="2" r="1" fill="#1a2a1a"/>`;
  }

  // SFP uplinks (far right of port area)
  const sfpX = portStartX + 12 * stride + 4;
  const uplinks = sfpPort(sfpX, 4) + sfpPort(sfpX + 18, 4);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#1a2a3a" rx="2"/>
  <rect width="${W}" height="1" fill="rgba(255,255,255,0.07)" rx="2"/>
  <rect y="${H - 1}" width="${W}" height="1" fill="rgba(0,0,0,0.4)"/>
  ${ear(0)}
  ${label('NX-24P', '#6a9aba')}
  <rect x="74" y="1" width="322" height="16" fill="rgba(0,0,0,0.25)" rx="1"/>
  ${leds}
  ${ports}
  ${uplinks}
  ${statusLed('#30d060', '#80ff90')}
  ${ear(408)}
</svg>`;
}

/** 1U server faceplate */
export function buildServerSvg(): string {
  // Drive bay indicators
  let bays = '';
  for (let i = 0; i < 4; i++) {
    const bx = 76 + i * 22;
    bays += `
      <rect x="${bx}" y="3" width="18" height="12" fill="#06100a" rx="1"/>
      <rect x="${bx + 1}" y="4" width="16" height="1" fill="rgba(255,255,255,0.06)"/>
      <rect x="${bx + 3}" y="6" width="12" height="7" fill="#040c08" rx="1"/>
      <circle cx="${bx + 9}" cy="13.5" r="1" fill="#1a3a20"/>`;
  }

  // Fan grille (right side)
  let grille = '';
  for (let i = 0; i < 5; i++) {
    const gx = 280 + i * 7;
    grille += `<line x1="${gx}" y1="3" x2="${gx}" y2="${H - 3}" stroke="#1e3828" stroke-width="1.5"/>`;
  }

  // USB + VGA ports
  const ports = `
    <rect x="320" y="5" width="10" height="8" fill="#06100a" rx="1"/>
    <rect x="334" y="4" width="16" height="10" fill="#06100a" rx="1"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#1a2e1e" rx="2"/>
  <rect width="${W}" height="1" fill="rgba(255,255,255,0.07)" rx="2"/>
  <rect y="${H - 1}" width="${W}" height="1" fill="rgba(0,0,0,0.4)"/>
  ${ear(0)}
  ${label('SRV-1U', '#5a9a6a')}
  ${bays}
  ${grille}
  ${ports}
  ${statusLed('#30d060', '#80ff90')}
  ${ear(408)}
</svg>`;
}

/** 1U router faceplate */
export function buildRouterSvg(): string {
  // 4 WAN/LAN ports — larger than switch ports
  let ports = '';
  const portLabels = ['WAN', 'LAN', 'LAN', 'LAN'];
  for (let i = 0; i < 4; i++) {
    const px = 100 + i * 48;
    ports += `
      <rect x="${px}" y="2" width="40" height="14" fill="#06090a" rx="1"/>
      <rect x="${px + 1}" y="3" width="38" height="1" fill="rgba(255,255,255,0.06)"/>
      <rect x="${px + 4}" y="5" width="32" height="7" fill="#040608" rx="1"/>
      <circle cx="${px + 20}" cy="14.5" r="1.5" fill="#1a2010"/>
      <text x="${px + 10}" y="11" font-size="4" fill="#604820" font-family="monospace">${portLabels[i]}</text>`;
  }

  // Console port
  const console_ = `
    <rect x="300" y="5" width="10" height="8" fill="#040608" rx="1"/>
    <text x="301" y="16" font-size="3.5" fill="#483820" font-family="monospace">CON</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#2e2010" rx="2"/>
  <rect width="${W}" height="1" fill="rgba(255,255,255,0.07)" rx="2"/>
  <rect y="${H - 1}" width="${W}" height="1" fill="rgba(0,0,0,0.4)"/>
  ${ear(0)}
  ${label('RTR-4P', '#b87828')}
  ${ports}
  ${console_}
  ${statusLed('#30d060', '#80ff90')}
  ${ear(408)}
</svg>`;
}

/** 1U firewall faceplate */
export function buildFirewallSvg(): string {
  // Red accent stripe
  const stripe = `<rect x="12" y="0" width="396" height="2" fill="#6a1010" opacity="0.6"/>`;

  // 4 interface ports with zone labels
  let ports = '';
  const zoneColors = ['#8a2020', '#204820', '#204820', '#204820'];
  const zoneLabels = ['WAN', 'DMZ', 'LAN', 'LAN'];
  for (let i = 0; i < 4; i++) {
    const px = 100 + i * 52;
    ports += `
      <rect x="${px}" y="2" width="44" height="14" fill="${zoneColors[i]}" rx="1" opacity="0.3"/>
      <rect x="${px + 2}" y="4" width="40" height="8" fill="#040608" rx="1"/>
      <rect x="${px + 3}" y="5" width="38" height="1" fill="rgba(255,255,255,0.06)"/>
      <circle cx="${px + 22}" cy="14" r="1.5" fill="#301010"/>
      <text x="${px + 12}" y="10" font-size="4" fill="${zoneColors[i]}" font-family="monospace" opacity="0.9">${zoneLabels[i]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#2e1414" rx="2"/>
  ${stripe}
  <rect width="${W}" height="1" fill="rgba(255,255,255,0.05)" rx="2"/>
  <rect y="${H - 1}" width="${W}" height="1" fill="rgba(0,0,0,0.4)"/>
  ${ear(0)}
  ${label('FW-4P', '#c84040')}
  ${ports}
  ${statusLed('#30d060', '#80ff90')}
  ${ear(408)}
</svg>`;
}

/** Map from Phaser texture key → SVG builder */
export const DEVICE_SVG_BUILDERS: Record<string, () => string> = {
  'device-switch':   buildSwitchSvg,
  'device-server':   buildServerSvg,
  'device-router':   buildRouterSvg,
  'device-firewall': buildFirewallSvg,
};
