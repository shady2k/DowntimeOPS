/**
 * Audio event registry and sound trigger system.
 *
 * Fires named events for all gameplay interactions. A future audio engine
 * subscribes via onAudioEvent() and plays the appropriate sound.
 *
 * Sound Asset Mapping (for audio implementation):
 *
 * | Event              | Suggested Sound                  | Priority |
 * |--------------------|----------------------------------|----------|
 * | device_place       | Metallic slide + click/snap      | High     |
 * | device_remove      | Unscrew + slide out              | Medium   |
 * | cable_connect      | RJ45 click                       | High     |
 * | cable_disconnect   | Cable pull / unplug              | Medium   |
 * | port_fail          | Electric crackle / spark         | High     |
 * | port_repair        | Wrench click + power-up hum      | High     |
 * | device_fail        | Alarm beep + power-down whine    | High     |
 * | device_recover     | System boot chime                | Medium   |
 * | alert_fire         | Short notification ping          | High     |
 * | alert_critical     | Urgent alarm tone                | High     |
 * | revenue_tick       | Soft cash register ding          | Low      |
 * | client_accept      | Contract stamp / approval chime  | Medium   |
 * | client_reject      | Paper crumple / decline tone     | Low      |
 * | client_churn       | Door close / departure tone      | Medium   |
 * | traffic_restore    | Network reconnect whoosh         | Medium   |
 * | milestone_unlock   | Achievement fanfare (short)      | High     |
 * | sla_violation      | Warning buzzer                   | High     |
 * | prospect_expire    | Missed opportunity tone          | Low      |
 * | ui_click           | Soft click                       | Low      |
 * | ui_tab_switch      | Tab swoosh                       | Low      |
 */

export type AudioEventType =
  | "device_place"
  | "device_remove"
  | "cable_connect"
  | "cable_disconnect"
  | "port_fail"
  | "port_repair"
  | "device_fail"
  | "device_recover"
  | "alert_fire"
  | "alert_critical"
  | "revenue_tick"
  | "client_accept"
  | "client_reject"
  | "client_churn"
  | "traffic_restore"
  | "milestone_unlock"
  | "sla_violation"
  | "prospect_expire"
  | "ui_click"
  | "ui_tab_switch";

/** Priority levels for mixing / volume ducking */
export type AudioPriority = "high" | "medium" | "low";

const EVENT_PRIORITY: Record<AudioEventType, AudioPriority> = {
  device_place: "high",
  device_remove: "medium",
  cable_connect: "high",
  cable_disconnect: "medium",
  port_fail: "high",
  port_repair: "high",
  device_fail: "high",
  device_recover: "medium",
  alert_fire: "high",
  alert_critical: "high",
  revenue_tick: "low",
  client_accept: "medium",
  client_reject: "low",
  client_churn: "medium",
  traffic_restore: "medium",
  milestone_unlock: "high",
  sla_violation: "high",
  prospect_expire: "low",
  ui_click: "low",
  ui_tab_switch: "low",
};

export interface AudioEventData {
  event: AudioEventType;
  priority: AudioPriority;
  data?: Record<string, unknown>;
  timestamp: number;
}

type AudioEventListener = (eventData: AudioEventData) => void;

const listeners: AudioEventListener[] = [];

// Rate limiting: prevent audio spam
const lastEmitTime: Partial<Record<AudioEventType, number>> = {};
const MIN_INTERVAL_MS: Partial<Record<AudioEventType, number>> = {
  revenue_tick: 5000,
  ui_click: 100,
  port_fail: 500,
  traffic_restore: 1000,
};

export function onAudioEvent(listener: AudioEventListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function emitAudioEvent(
  event: AudioEventType,
  data?: Record<string, unknown>,
): void {
  const now = Date.now();

  // Rate limit
  const minInterval = MIN_INTERVAL_MS[event];
  if (minInterval) {
    const last = lastEmitTime[event] ?? 0;
    if (now - last < minInterval) return;
  }
  lastEmitTime[event] = now;

  const eventData: AudioEventData = {
    event,
    priority: EVENT_PRIORITY[event],
    data,
    timestamp: now,
  };

  for (const listener of listeners) {
    listener(eventData);
  }
}
