/**
 * NX-24P — 24-port managed switch faceplate.
 *
 * Front panel: 12-column × 2-row RJ45 grid, activity LEDs between rows,
 * 2× SFP uplink cages, USB management port, chassis vents.
 * Phaser key: "device-switch" | JSON: device-switch-24p.json
 */

import { label, rj45, sfp, consolePort, usb, vents, svgDoc } from "./DeviceBuilder";

export function buildSwitchSvg(): string {
  const portW = 13;
  const portH = 6;
  const stride = 15;      // 13px port + 2px gap
  const row1Y = 3;
  const row2Y = 10;
  const startX = 78;

  let ports = '';
  for (let col = 0; col < 12; col++) {
    const px = startX + col * stride;
    ports += rj45(px, row1Y, portW, portH);
    ports += rj45(px, row2Y, portW, portH);
  }

  const sfpX = startX + 12 * stride + 3;   // ≈ 261
  const conX = sfpX + 14 + 3 + 14 + 5;    // ≈ 297
  const usbX = conX + 12 + 4;             // ≈ 313
  const ventX = usbX + 9 + 4;             // ≈ 326

  const content = `
  ${label('NX-24P', '#5a90b8')}
  <rect x="76" y="1" width="330" height="16" fill="rgba(0,0,0,0.18)" rx="1"/>
  ${ports}
  ${sfp(sfpX, 3)}
  ${sfp(sfpX + 17, 3)}
  ${consolePort(conX, 4)}
  ${usb(usbX, 5)}
  ${vents(ventX, 405 - ventX)}`;

  return svgDoc('#111e2a', content);
}
