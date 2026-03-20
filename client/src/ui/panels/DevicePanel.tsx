import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import type { Device, Port, GameState } from "@downtime-ops/shared";

export function DevicePanel() {
  const state = useGameStore((s) => s.state);
  const selectedDeviceId = useGameStore((s) => s.selectedDeviceId);

  if (!state || !selectedDeviceId) {
    return (
      <div style={{ padding: 12 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
          DEVICE PANEL
        </h3>
        <p style={{ fontSize: 11, color: "#666" }}>
          Click a device in the rack to inspect it.
        </p>
      </div>
    );
  }

  const device = state.devices[selectedDeviceId];
  if (!device) return null;

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        DEVICE: {device.name}
      </h3>

      <div style={{ fontSize: 11, marginBottom: 12 }}>
        <Row label="Type" value={device.type} />
        <Row label="Status" value={device.status} />
        <Row label="Model" value={device.model} />
        <Row label="Slot" value={`U${device.slotU}`} />
        <Row label="Power" value={`${device.powerDrawWatts}W`} />
        {device.config.ip && (
          <Row label="IP" value={device.config.ip as string} />
        )}
      </div>

      <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#95a5a6" }}>
        PORTS ({device.ports.length})
      </h4>

      <div style={{ fontSize: 10 }}>
        {device.ports.map((port) => (
          <PortRow
            key={port.id}
            port={port}
            device={device}
            state={state}
          />
        ))}
      </div>

      <button
        onClick={() => {
          rpcClient
            .call("removeDevice", { deviceId: device.id })
            .catch(() => {});
          useGameStore.getState().selectDevice(null);
        }}
        style={{
          marginTop: 12,
          padding: "4px 12px",
          background: "#e74c3c",
          color: "#fff",
          border: "none",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: 11,
        }}
      >
        Remove Device
      </button>
    </div>
  );
}

function PortRow({
  port,
  device,
  state,
}: {
  port: Port;
  device: Device;
  state: GameState;
}) {
  const statusColor =
    port.status === "up"
      ? "#2ecc71"
      : port.status === "down"
        ? "#e74c3c"
        : "#f39c12";

  const linkedDevice = port.linkId
    ? findLinkedDevice(state, device.id, port.linkId)
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 0",
        borderBottom: "1px solid #222",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: statusColor,
          flexShrink: 0,
        }}
      />
      <span style={{ width: 30 }}>p{port.index}</span>
      <span style={{ flex: 1, color: "#666" }}>
        {port.linkId
          ? `→ ${linkedDevice?.name || "?"}`
          : "disconnected"}
      </span>

      {port.status !== "up" && (
        <button
          onClick={() => {
            rpcClient
              .call("repairPort", {
                deviceId: device.id,
                portIndex: port.index,
              })
              .catch(() => {});
          }}
          style={{
            padding: "1px 6px",
            background: "#f39c12",
            color: "#fff",
            border: "none",
            borderRadius: 2,
            cursor: "pointer",
            fontSize: 9,
          }}
        >
          Repair $200
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", padding: "2px 0" }}>
      <span style={{ width: 70, color: "#666" }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function findLinkedDevice(
  state: GameState,
  currentDeviceId: string,
  linkId: string,
) {
  const link = state.links[linkId];
  if (!link) return null;
  const otherId =
    link.portA.deviceId === currentDeviceId
      ? link.portB.deviceId
      : link.portA.deviceId;
  return state.devices[otherId] || null;
}
