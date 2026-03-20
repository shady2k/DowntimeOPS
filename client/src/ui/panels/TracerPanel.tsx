import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import type { TracerPacket } from "@downtime-ops/shared";

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
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        PACKET TRACER
      </h3>

      <div style={{ display: "flex", gap: 4, marginBottom: 4, fontSize: 10 }}>
        <select
          value={srcIp}
          onChange={(e) => setSrcIp(e.target.value)}
          style={{
            flex: 1,
            background: "#1a1a2e",
            color: "#ecf0f1",
            border: "1px solid #333",
            borderRadius: 3,
            padding: 3,
            fontSize: 10,
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
            flex: 1,
            background: "#1a1a2e",
            color: "#ecf0f1",
            border: "1px solid #333",
            borderRadius: 3,
            padding: 3,
            fontSize: 10,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button
          onClick={startTrace}
          disabled={!srcIp || !dstIp}
          style={{
            padding: "3px 10px",
            background: srcIp && dstIp ? "#9b59b6" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: srcIp && dstIp ? "pointer" : "default",
            fontSize: 10,
          }}
        >
          Start Trace
        </button>
        <button
          onClick={stepTrace}
          disabled={!tracerId}
          style={{
            padding: "3px 10px",
            background: tracerId ? "#3498db" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: tracerId ? "pointer" : "default",
            fontSize: 10,
          }}
        >
          Step
        </button>
      </div>

      {packet && (
        <div style={{ fontSize: 10 }}>
          <div
            style={{
              marginBottom: 6,
              padding: 4,
              background:
                packet.status === "delivered"
                  ? "#1a3a2e"
                  : packet.status === "dropped"
                    ? "#3a1a1a"
                    : "#1a1a2e",
              borderRadius: 3,
            }}
          >
            Status:{" "}
            <span
              style={{
                color:
                  packet.status === "delivered"
                    ? "#2ecc71"
                    : packet.status === "dropped"
                      ? "#e74c3c"
                      : "#3498db",
                fontWeight: "bold",
              }}
            >
              {packet.status.toUpperCase()}
            </span>
            {" | "}TTL: {packet.ttl}
          </div>

          <h4 style={{ margin: "0 0 4px", fontSize: 11, color: "#666" }}>
            Hops ({packet.hops.length})
          </h4>

          {packet.hops.map((hop, i) => (
            <div
              key={i}
              style={{
                padding: 4,
                marginBottom: 2,
                background: "#1a1a2e",
                borderRadius: 3,
                borderLeft: `3px solid ${
                  hop.decision.type === "drop" ? "#e74c3c" : "#2ecc71"
                }`,
              }}
            >
              <div style={{ color: "#95a5a6" }}>
                Hop {i + 1}:{" "}
                {state.devices[hop.deviceId]?.name || hop.deviceId}
              </div>
              <div>{hop.action}</div>
              {hop.decision.matchedRule && (
                <div style={{ color: "#666" }}>
                  Rule: {hop.decision.matchedRule}
                </div>
              )}
              {hop.decision.reason && (
                <div style={{ color: "#e74c3c" }}>
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
