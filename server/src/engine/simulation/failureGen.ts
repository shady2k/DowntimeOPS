import type { GameState } from "@downtime-ops/shared";
import { BALANCE } from "../config/balance";

export function generateFailures(
  state: GameState,
  rng: () => number = Math.random,
): GameState {
  // Don't generate random failures until the player has activated their first client
  if (!state.tutorial.firstClientActivated) return state;

  let devicesChanged = false;
  const newDevices = { ...state.devices };
  const newAlerts = [...state.alerts];
  const newLog = [...state.log];

  for (const device of Object.values(state.devices)) {
    if (device.status === "failed" || device.status === "offline") continue;

    let portsChanged = false;
    const newPorts = [...device.ports];

    for (let i = 0; i < device.ports.length; i++) {
      const port = device.ports[i];
      if (port.status !== "up") continue;

      if (rng() < BALANCE.PORT_FAILURE_CHANCE_PER_TICK) {
        newPorts[i] = { ...port, status: "down" };
        portsChanged = true;

        newAlerts.push({
          id: `alert-${crypto.randomUUID()}`,
          type: "port_down",
          severity: "critical",
          message: `Port ${i} on ${device.name} went down`,
          deviceId: device.id,
          portIndex: i,
          tick: state.tick,
          acknowledged: false,
        });

        newLog.push({
          id: `log-${crypto.randomUUID()}`,
          tick: state.tick,
          message: `Port ${i} on ${device.name} failed`,
          category: "network",
        });
      }
    }

    if (portsChanged) {
      devicesChanged = true;
      newDevices[device.id] = { ...device, ports: newPorts };
    }
  }

  if (!devicesChanged) {
    return { ...state, alerts: newAlerts, log: newLog };
  }

  return { ...state, devices: newDevices, alerts: newAlerts, log: newLog };
}
