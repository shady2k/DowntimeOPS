import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import type { CableType } from "@downtime-ops/shared";

export function CablePanel() {
  const state = useGameStore((s) => s.state);
  const [cableStart, setCableStart] = useState<{
    deviceId: string;
    portIndex: number;
  } | null>(null);

  if (!state) return null;

  const devices = Object.values(state.devices);
  const availablePorts = devices.flatMap((d) =>
    d.ports
      .filter((p) => !p.linkId && p.status === "up")
      .map((p) => ({ device: d, port: p })),
  );

  const connect = (deviceId: string, portIndex: number) => {
    if (!cableStart) {
      setCableStart({ deviceId, portIndex });
      return;
    }

    if (cableStart.deviceId === deviceId) {
      setCableStart(null);
      return;
    }

    const params = {
      portA: `${cableStart.deviceId}-p${cableStart.portIndex}`,
      portB: `${deviceId}-p${portIndex}`,
      cableType: "cat6" as CableType,
      deviceIdA: cableStart.deviceId,
      portIndexA: cableStart.portIndex,
      deviceIdB: deviceId,
      portIndexB: portIndex,
    };
    rpcClient.call("connectPorts", params as never).catch(() => {});

    setCableStart(null);
  };

  const disconnect = (linkId: string) => {
    rpcClient.call("disconnectPorts", { linkId }).catch(() => {});
  };

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        CABLING
      </h3>

      {cableStart && (
        <div
          style={{
            padding: 6,
            marginBottom: 8,
            background: "#2c3e50",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          Select target port for:{" "}
          {state.devices[cableStart.deviceId]?.name} p{cableStart.portIndex}
          <button
            onClick={() => setCableStart(null)}
            style={{
              marginLeft: 8,
              padding: "1px 6px",
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 9,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <h4 style={{ margin: "0 0 4px", fontSize: 11, color: "#666" }}>
        Available Ports
      </h4>
      {availablePorts.length === 0 && (
        <p style={{ fontSize: 10, color: "#555" }}>No available ports</p>
      )}
      {availablePorts.slice(0, 20).map(({ device, port }) => (
        <div
          key={port.id}
          onClick={() => connect(device.id, port.index)}
          style={{
            padding: "3px 6px",
            marginBottom: 2,
            background:
              cableStart?.deviceId === device.id &&
              cableStart?.portIndex === port.index
                ? "#2c3e50"
                : "#1a1a2e",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          {device.name} → p{port.index}
        </div>
      ))}

      <h4 style={{ margin: "12px 0 4px", fontSize: 11, color: "#666" }}>
        Active Cables ({Object.keys(state.links).length})
      </h4>
      {Object.values(state.links).map((link) => {
        const devA = state.devices[link.portA.deviceId];
        const devB = state.devices[link.portB.deviceId];
        return (
          <div
            key={link.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 6px",
              marginBottom: 2,
              background: "#1a1a2e",
              borderRadius: 3,
              fontSize: 10,
            }}
          >
            <span style={{ flex: 1 }}>
              {devA?.name}:p{link.portA.portIndex} ↔ {devB?.name}:p
              {link.portB.portIndex}
            </span>
            <span style={{ color: "#666" }}>
              {link.currentLoadMbps.toFixed(0)}/{link.maxBandwidthMbps}Mbps
            </span>
            <button
              onClick={() => disconnect(link.id)}
              style={{
                padding: "1px 4px",
                background: "#e74c3c",
                color: "#fff",
                border: "none",
                borderRadius: 2,
                cursor: "pointer",
                fontSize: 9,
              }}
            >
              X
            </button>
          </div>
        );
      })}
    </div>
  );
}
