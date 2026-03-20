import type { Device } from "./Device";

export interface Rack {
  id: string;
  name: string;
  totalU: number;
  devices: Record<number, Device>;
  powerBudgetWatts: number;
  currentPowerWatts: number;
}
