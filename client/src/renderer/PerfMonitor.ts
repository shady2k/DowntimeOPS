/**
 * Performance budget monitor for the Phaser renderer.
 * Tracks object counts and frame times, warns when budgets are exceeded.
 */

export interface PerfBudget {
  maxDeviceSprites: number;
  maxPortSprites: number;
  maxTrafficPulses: number;
  maxCableSegments: number;
  maxEffectParticles: number;
  maxTotalGameObjects: number;
  targetFps: number;
  warnFpsThreshold: number;
}

export const DEFAULT_BUDGET: PerfBudget = {
  maxDeviceSprites: 42, // one per U slot
  maxPortSprites: 600, // 24 ports × 25 devices max
  maxTrafficPulses: 50, // 4 per link × ~12 links
  maxCableSegments: 50, // one per link
  maxEffectParticles: 100, // sparks, glows
  maxTotalGameObjects: 2000,
  targetFps: 60,
  warnFpsThreshold: 30,
};

export interface PerfSnapshot {
  fps: number;
  deviceCount: number;
  portCount: number;
  pulseCount: number;
  cableCount: number;
  totalObjects: number;
  warnings: string[];
}

export class PerfMonitor {
  private budget: PerfBudget;
  private frameTimes: number[] = [];
  private maxFrameSamples = 60;

  constructor(budget: PerfBudget = DEFAULT_BUDGET) {
    this.budget = budget;
  }

  recordFrameTime(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }
  }

  snapshot(counts: {
    devices: number;
    ports: number;
    pulses: number;
    cables: number;
    totalObjects: number;
  }): PerfSnapshot {
    const avgDt =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 16.67;
    const fps = 1000 / avgDt;

    const warnings: string[] = [];

    if (fps < this.budget.warnFpsThreshold) {
      warnings.push(`FPS ${fps.toFixed(0)} below threshold ${this.budget.warnFpsThreshold}`);
    }
    if (counts.devices > this.budget.maxDeviceSprites) {
      warnings.push(
        `Devices ${counts.devices} > budget ${this.budget.maxDeviceSprites}`,
      );
    }
    if (counts.ports > this.budget.maxPortSprites) {
      warnings.push(
        `Ports ${counts.ports} > budget ${this.budget.maxPortSprites}`,
      );
    }
    if (counts.pulses > this.budget.maxTrafficPulses) {
      warnings.push(
        `Pulses ${counts.pulses} > budget ${this.budget.maxTrafficPulses}`,
      );
    }
    if (counts.totalObjects > this.budget.maxTotalGameObjects) {
      warnings.push(
        `Total objects ${counts.totalObjects} > budget ${this.budget.maxTotalGameObjects}`,
      );
    }

    return {
      fps,
      deviceCount: counts.devices,
      portCount: counts.ports,
      pulseCount: counts.pulses,
      cableCount: counts.cables,
      totalObjects: counts.totalObjects,
      warnings,
    };
  }
}
