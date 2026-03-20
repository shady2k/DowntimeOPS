import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import type { Device, Port, GameState } from "@downtime-ops/shared";
import { THEME, headingStyle, buttonStyle, statusDot } from "../theme";

export function DevicePanel() {
  const state = useGameStore((s) => s.state);
  const selectedDeviceId = useGameStore((s) => s.selectedDeviceId);

  if (!state || !selectedDeviceId) {
    return (
      <div style={{ padding: 12 }}>
        <h3 style={headingStyle()}>
          DEVICE PANEL
        </h3>
        <p style={{ fontSize: 11, color: THEME.colors.textDim, fontFamily: THEME.fonts.body }}>
          Click a device in the rack to inspect it.
        </p>
      </div>
    );
  }

  const device = state.devices[selectedDeviceId];
  if (!device) return null;

  return (
    <div style={{ padding: 12 }}>
      <h3 style={headingStyle()}>
        DEVICE: {device.name}
      </h3>

      <div style={{ fontSize: 11, marginBottom: 12, fontFamily: THEME.fonts.body }}>
        <Row label="Type" value={device.type} />
        <Row label="Status" value={device.status} />
        <Row label="Model" value={device.model} />
        <Row label="Slot" value={`U${device.slotU}`} />
        <Row label="Power" value={`${device.powerDrawWatts}W`} />
        {device.config.ip ? (
          <Row label="IP" value={String(device.config.ip)} />
        ) : null}
      </div>

      <h4 style={headingStyle("h4")}>
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
          ...buttonStyle("danger"),
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
      ? THEME.colors.success
      : port.status === "down"
        ? THEME.colors.danger
        : THEME.colors.warning;

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
        borderBottom: `1px solid ${THEME.colors.borderDark}`,
      }}
    >
      <span
        style={statusDot(statusColor, 8)}
      />
      <span style={{ width: 30, fontFamily: THEME.fonts.mono }}>{`p${port.index}`}</span>
      <span style={{ flex: 1, color: THEME.colors.textDim }}>
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
            ...buttonStyle("primary", true),
            background: THEME.colors.warning,
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
      <span style={{ width: 70, color: THEME.colors.textDim, fontFamily: THEME.fonts.body }}>{label}:</span>
      <span style={{ fontFamily: THEME.fonts.mono }}>{value}</span>
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
