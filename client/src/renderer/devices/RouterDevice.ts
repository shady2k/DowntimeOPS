/**
 * RTR-4P — 1U router faceplate.
 *
 * Front panel: 1× WAN + 3× LAN RJ45 ports, console, USB-A, chassis vents.
 * WAN port has a blue-tinted bezel to distinguish it from LAN ports.
 * Phaser key: "device-router" | JSON: device-router-1u.json
 */

import { label, rj45, consolePort, usb, vents, svgDoc } from "./DeviceBuilder";

export function buildRouterSvg(): string {
  const portW = 16;
  const portH = 10;
  const portY = 4;
  const stride = 19;
  const startX = 80;

  // WAN port — blue-tinted bezel to mark upstream interface
  const wan = `
    <rect x="${startX}" y="${portY}" width="${portW}" height="${portH}" fill="#060c12" rx="1"/>
    <rect x="${startX + 1}" y="${portY + 1}" width="${portW - 2}" height="${portH - 2}" fill="#020608" rx="0.5"/>
    <rect x="${startX + 2}" y="${portY + 1}" width="${portW - 4}" height="1" fill="rgba(80,120,200,0.1)"/>
    <rect x="${startX + 2}" y="${portY + portH - 3}" width="${portW - 4}" height="1.5" fill="#08101e"/>
    <text x="${startX + 2}" y="${portY - 1}" font-size="3" fill="rgba(80,130,200,0.5)" font-family="monospace">WAN</text>`;

  // LAN ports ×3
  let lanPorts = '';
  for (let i = 1; i <= 3; i++) {
    const px = startX + i * stride;
    lanPorts += rj45(px, portY, portW, portH);
    lanPorts += `<text x="${px + 2}" y="${portY - 1}" font-size="3" fill="rgba(80,160,80,0.4)" font-family="monospace">LAN</text>`;
  }

  const conX = startX + 4 * stride + 2;   // ≈ 158
  const usbX = conX + 12 + 4;             // ≈ 174
  const ventX = usbX + 9 + 5;             // ≈ 188

  const content = `
  ${label('RTR-4P', '#b87828')}
  ${wan}
  ${lanPorts}
  ${consolePort(conX, 4)}
  ${usb(usbX, 5)}
  ${vents(ventX, 405 - ventX)}`;

  return svgDoc('#231c0e', content);
}
