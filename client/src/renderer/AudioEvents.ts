/**
 * Audio event registry. Fires named events that a future audio system
 * can subscribe to. No actual audio playback yet — this is the hook layer.
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
  | "revenue_tick"
  | "client_accept"
  | "client_reject"
  | "traffic_restore";

type AudioEventListener = (event: AudioEventType, data?: Record<string, unknown>) => void;

const listeners: AudioEventListener[] = [];

export function onAudioEvent(listener: AudioEventListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function emitAudioEvent(event: AudioEventType, data?: Record<string, unknown>): void {
  for (const listener of listeners) {
    listener(event, data);
  }
}
