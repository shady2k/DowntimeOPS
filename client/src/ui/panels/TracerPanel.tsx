import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import type { TracerPacket } from "@downtime-ops/shared";
import { THEME, headingStyle, inputStyle, buttonStyle, cardStyle } from "../theme";

export function TracerPanel() {
  const state = useGameStore((s) => s.state);
  const [srcIp, setSrcIp] = useState("");
  const [dstIp, setDstIp] = useState("");
  const [tracerId, setTracerId] = useState<string | null>(null);
  const [packet, setPacket] = useState<TracerPacket | null>(null);

  if (!state) return null;

  // Collect available IPs for quick selection
  const deviceIps = Object.values(state.devices)
    .filter((d) => d.config.ip)
    .map((d) => ({ name: d.name, ip: d.config.ip as string }));

  const startTrace = async () => {
    if (!srcIp || !dstIp) return;
    try {
      const result = (await rpcClient.call("startTracer", {
        srcIp,
        dstIp,
        protocol: "tcp",
        dstPort: 443,
      })) as { tracerId: string };
      setTracerId(result.tracerId);
      setPacket(null);
    } catch {
      // Ignore
    }
  };

  const stepTrace = async () => {
    if (!tracerId) return;
    try {
      const result = (await rpcClient.call("stepTracer", {
        tracerId,
      })) as { packet: TracerPacket };
      setPacket(result.packet);
      if (
        result.packet.status === "delivered" ||
        result.packet.status === "dropped" ||
        result.packet.status === "expired"
      ) {
        setTracerId(null);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <h3 style={headingStyle()}>
        PACKET TRACER
      </h3>

      <div style={{ display: "flex", gap: 4, marginBottom: 4, fontSize: 10 }}>
        <select
          value={srcIp}
          onChange={(e) => setSrcIp(e.target.value)}
          style={{
            ...inputStyle(),
            flex: 1,
          }}
        >
          <option value="">Source IP</option>
          {deviceIps.map((d) => (
            <option key={d.ip} value={d.ip}>
              {d.name} ({d.ip})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8, fontSize: 10 }}>
        <input
          value={dstIp}
          onChange={(e) => setDstIp(e.target.value)}
          placeholder="Destination IP (e.g. 203.0.113.1)"
          style={{
            ...inputStyle(),
            flex: 1,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button
          onClick={startTrace}
          disabled={!srcIp || !dstIp}
          style={
            srcIp && dstIp
              ? { ...buttonStyle("primary"), background: THEME.colors.purple, color: "#fff" }
              : buttonStyle("muted")
          }
        >
          Start Trace
        </button>
        <button
          onClick={stepTrace}
          disabled={!tracerId}
          style={
            tracerId
              ? { ...buttonStyle("primary"), background: THEME.colors.info, color: "#fff" }
              : buttonStyle("muted")
          }
        >
          Step
        </button>
      </div>

      {packet && (
        <div style={{ fontSize: 10 }}>
          <div
            style={{
              ...cardStyle(),
              marginBottom: 6,
              background:
                packet.status === "delivered"
                  ? THEME.colors.successBg
                  : packet.status === "dropped"
                    ? THEME.colors.dangerBg
                    : THEME.colors.bgCard,
            }}
          >
            Status:{" "}
            <span
              style={{
                color:
                  packet.status === "delivered"
                    ? THEME.colors.success
                    : packet.status === "dropped"
                      ? THEME.colors.danger
                      : THEME.colors.info,
                fontWeight: "bold",
              }}
            >
              {packet.status.toUpperCase()}
            </span>
            {" | "}TTL: {packet.ttl}
          </div>

          <h4 style={headingStyle("h4")}>
            Hops ({packet.hops.length})
          </h4>

          {packet.hops.map((hop, i) => (
            <div
              key={i}
              style={{
                ...cardStyle(
                  hop.decision.type === "drop" ? THEME.colors.danger : THEME.colors.success
                ),
                marginBottom: 2,
              }}
            >
              <div style={{ color: THEME.colors.textMuted }}>
                Hop {i + 1}:{" "}
                {state.devices[hop.deviceId]?.name || hop.deviceId}
              </div>
              <div>{hop.action}</div>
              {hop.decision.matchedRule && (
                <div style={{ color: THEME.colors.textDim }}>
                  Rule: {hop.decision.matchedRule}
                </div>
              )}
              {hop.decision.reason && (
                <div style={{ color: THEME.colors.danger }}>
                  Reason: {hop.decision.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
