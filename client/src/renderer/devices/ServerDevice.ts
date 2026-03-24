/**
 * SRV-1U — 1U rack server faceplate.
 *
 * Front panel: power button, 2× hot-swap 2.5" drive bays, USB-A,
 * 2× RJ45 ethernet ports (NIC0/NIC1), chassis vents.
 * Phaser key: "device-server" | JSON: device-server-1u.json
 */

import { label, rj45, usb, vents, svgDoc } from "./DeviceBuilder";

function powerButton(cx: number, cy: number): string {
  return `
    <circle cx="${cx}" cy="${cy}" r="5.5" fill="#0a140c"/>
    <circle cx="${cx}" cy="${cy}" r="5.5" stroke="rgba(255,255,255,0.08)" stroke-width="1" fill="none"/>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="#061008"/>
    <line x1="${cx}" y1="${cy - 4}" x2="${cx}" y2="${cy - 2}" stroke="rgba(90,160,100,0.7)" stroke-width="1"/>`;
}

function driveBay(x: number): string {
  return `
    <rect x="${x}" y="3" width="24" height="12" fill="#06100a" rx="1"/>
    <rect x="${x + 1}" y="4" width="22" height="1" fill="rgba(255,255,255,0.05)"/>
    <rect x="${x + 2}" y="5" width="20" height="8" fill="#040c08" rx="0.5"/>
    <rect x="${x + 3}" y="12" width="18" height="1.5" fill="#0a1a0c"/>
    <circle cx="${x + 22}" cy="5.5" r="1.2" fill="#081408"/>`;
}

export function buildServerSvg(): string {
  const usbX = 158;
  const nic0X = 172;
  const nic1X = 190;
  const portW = 16;
  const portH = 10;
  const portY = 4;

  const content = `
  ${label('SRV-1U', '#5a9a6a')}
  ${powerButton(82, 9)}
  ${driveBay(94)}
  ${driveBay(121)}
  ${usb(usbX, 5)}
  ${rj45(nic0X, portY, portW, portH)}
  ${rj45(nic1X, portY, portW, portH)}
  ${vents(210, 195)}`;

  return svgDoc('#132016', content);
}
