/**
 * FW-4P — 1U firewall / UTM appliance faceplate.
 *
 * Front panel: red accent stripe, 4× zone-coloured RJ45 ports
 * (WAN / DMZ / LAN / LAN), console, USB-A, chassis vents.
 * Zone colour coding makes network topology immediately readable.
 * Phaser key: "device-firewall" | JSON: device-firewall-1u.json
 */

import { label, consolePort, usb, vents, svgDoc } from "./DeviceBuilder";

type Zone = { label: string; color: string; textColor: string };

const ZONES: Zone[] = [
  { label: 'WAN', color: '#7a1818', textColor: 'rgba(200,80,80,0.55)' },
  { label: 'DMZ', color: '#6a4010', textColor: 'rgba(200,150,60,0.55)' },
  { label: 'LAN', color: '#0e4018', textColor: 'rgba(60,180,80,0.45)' },
  { label: 'LAN', color: '#0e4018', textColor: 'rgba(60,180,80,0.45)' },
];

function zonePort(px: number, portY: number, portW: number, portH: number, z: Zone): string {
  return `
    <rect x="${px}" y="${portY}" width="${portW}" height="${portH}" fill="${z.color}" rx="1" opacity="0.45"/>
    <rect x="${px + 1}" y="${portY + 1}" width="${portW - 2}" height="${portH - 2}" fill="#020406" rx="0.5"/>
    <rect x="${px + 2}" y="${portY + 1}" width="${portW - 4}" height="1" fill="rgba(255,255,255,0.04)"/>
    <rect x="${px + 2}" y="${portY + portH - 3}" width="${portW - 4}" height="1.5" fill="#08080c"/>
    <text x="${px + 2}" y="${portY - 1}" font-size="3" fill="${z.textColor}" font-family="monospace">${z.label}</text>`;
}

export function buildFirewallSvg(): string {
  const portW = 16;
  const portH = 10;
  const portY = 4;
  const stride = 20;
  const startX = 80;

  let ports = '';
  for (let i = 0; i < ZONES.length; i++) {
    const px = startX + i * stride;
    ports += zonePort(px, portY, portW, portH, ZONES[i]);
  }

  const conX = startX + ZONES.length * stride + 3;   // ≈ 163
  const usbX = conX + 12 + 4;                        // ≈ 179
  const ventX = usbX + 9 + 5;                        // ≈ 193

  const redStripe = `<rect x="12" y="0" width="396" height="2" fill="#5a0c0c" opacity="0.7"/>`;

  const content = `
  ${label('FW-4P', '#c04040')}
  ${ports}
  ${consolePort(conX, 4)}
  ${usb(usbX, 5)}
  ${vents(ventX, 405 - ventX)}`;

  return svgDoc('#1e0e0e', content, redStripe);
}
