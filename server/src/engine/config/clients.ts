import type { Client, Contract } from "@downtime-ops/shared";
import { BALANCE } from "./balance";

export interface ClientTemplate {
  type: "startup" | "smb";
  namePool: string[];
  bandwidthRange: [number, number];
  uptimeSla: number;
  revenuePerMbps: number;
  penaltyPerViolation: number;
  durationMonths: [number, number];
}

const STARTUP_TEMPLATE: ClientTemplate = {
  type: "startup",
  namePool: [
    "PicoApp",
    "NanoSaaS",
    "TinyCloud",
    "MiniHost",
    "LiteStack",
    "QuickByte",
    "ZapHost",
    "PixelForge",
    "CodeSprout",
    "ByteLeaf",
  ],
  bandwidthRange: [5, 20],
  uptimeSla: 99.0,
  revenuePerMbps: 15,
  penaltyPerViolation: 100,
  durationMonths: [3, 6],
};

const SMB_TEMPLATE: ClientTemplate = {
  type: "smb",
  namePool: [
    "MidTech Solutions",
    "UrbanGrid Inc.",
    "DataBridge Corp.",
    "NetPeak Systems",
    "CloudVault Ltd.",
    "SteadyLink Co.",
    "CorePath Networks",
    "BrightEdge Digital",
    "PrimeLine Hosting",
    "AnchorPoint Data",
  ],
  bandwidthRange: [20, 100],
  uptimeSla: 99.5,
  revenuePerMbps: 12,
  penaltyPerViolation: 500,
  durationMonths: [6, 12],
};

export const CLIENT_TEMPLATES = [STARTUP_TEMPLATE, SMB_TEMPLATE] as const;

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateProspect(
  reputation: number,
  tick: number,
  rng: () => number = Math.random,
): Client {
  // Low reputation = mostly startups, higher rep = more SMBs
  const template =
    reputation < 40 || rng() < 0.6 ? STARTUP_TEMPLATE : SMB_TEMPLATE;

  const bandwidth = randInt(
    template.bandwidthRange[0],
    template.bandwidthRange[1],
    rng,
  );
  const duration = randInt(
    template.durationMonths[0],
    template.durationMonths[1],
    rng,
  );

  const contract: Contract = {
    bandwidthMbps: bandwidth,
    uptimeSla: template.uptimeSla,
    isolationRequired: false,
    dedicatedHardware: false,
    monthlyRevenue: bandwidth * template.revenuePerMbps,
    penaltyPerViolation: template.penaltyPerViolation,
    durationMonths: duration,
  };

  return {
    id: `client-${crypto.randomUUID()}`,
    name: pickRandom(template.namePool, rng),
    type: template.type,
    contract,
    satisfaction: 100,
    status: "prospect",
  };
}

export function shouldGenerateProspect(
  tick: number,
  prospectCount: number,
): boolean {
  return (
    tick % BALANCE.CLIENT_PROSPECT_INTERVAL_TICKS === 0 &&
    prospectCount < BALANCE.MAX_PROSPECTS
  );
}

export function isProspectExpired(
  prospectTick: number,
  currentTick: number,
): boolean {
  return currentTick - prospectTick >= BALANCE.PROSPECT_EXPIRE_TICKS;
}
