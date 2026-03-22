/**
 * Device SVG builder registry.
 *
 * Maps Phaser texture key → SVG builder function.
 * PreloadScene iterates this map to rasterise each device faceplate.
 *
 * To add a new device:
 *   1. Create `YourDevice.ts` with `buildYourDeviceSvg()`
 *   2. Add an entry here
 *   3. Add a JSON descriptor in client/public/assets/devices/
 */

export { buildRouterSvg }   from "./RouterDevice";
export { buildSwitchSvg }   from "./SwitchDevice";
export { buildServerSvg }   from "./ServerDevice";
export { buildFirewallSvg } from "./FirewallDevice";

import { buildRouterSvg }   from "./RouterDevice";
import { buildSwitchSvg }   from "./SwitchDevice";
import { buildServerSvg }   from "./ServerDevice";
import { buildFirewallSvg } from "./FirewallDevice";

export const DEVICE_SVG_BUILDERS: Record<string, () => string> = {
  "device-router":   buildRouterSvg,
  "device-switch":   buildSwitchSvg,
  "device-server":   buildServerSvg,
  "device-firewall": buildFirewallSvg,
};
