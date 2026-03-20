import type { Client, Contract, MilestoneState } from "@downtime-ops/shared";
import { BALANCE } from "./balance";

export interface ClientTemplate {
  type: "startup" | "smb" | "enterprise" | "bank";
  namePool: Array<{ name: string; flavor: string }>;
  bandwidthRange: [number, number];
  uptimeSla: number;
  revenuePerMbps: number;
  penaltyPerViolation: number;
  durationMonths: [number, number];
  isolationRequired: boolean;
}

const STARTUP_TEMPLATE: ClientTemplate = {
  type: "startup",
  namePool: [
    { name: "PicoApp", flavor: "A two-person team building a recipe app. Low-stakes, low-budget." },
    { name: "NanoSaaS", flavor: "Lean SaaS startup burning through their seed round." },
    { name: "TinyCloud", flavor: "Student project that somehow got paying users." },
    { name: "MiniHost", flavor: "Side project turned small business. Needs cheap hosting." },
    { name: "LiteStack", flavor: "Bootstrapped dev tools company. Every dollar counts." },
    { name: "QuickByte", flavor: "Food delivery aggregator. Spiky traffic during lunch." },
    { name: "ZapHost", flavor: "WordPress hosting reseller. High volume, low margins." },
    { name: "PixelForge", flavor: "Indie game studio hosting their multiplayer backend." },
    { name: "CodeSprout", flavor: "Coding bootcamp running their LMS platform." },
    { name: "ByteLeaf", flavor: "IoT plant monitoring. More sensors than employees." },
  ],
  bandwidthRange: [5, 20],
  uptimeSla: 99.0,
  revenuePerMbps: 15,
  penaltyPerViolation: 100,
  durationMonths: [3, 6],
  isolationRequired: false,
};

const SMB_TEMPLATE: ClientTemplate = {
  type: "smb",
  namePool: [
    { name: "MidTech Solutions", flavor: "Regional IT consultancy. Needs reliable email and file hosting." },
    { name: "UrbanGrid Inc.", flavor: "Smart city infrastructure company. Sensor data never sleeps." },
    { name: "DataBridge Corp.", flavor: "Data integration platform. Moves terabytes nightly." },
    { name: "NetPeak Systems", flavor: "Network monitoring vendor. Ironic if their host goes down." },
    { name: "CloudVault Ltd.", flavor: "Backup-as-a-service. Their clients' data is your responsibility." },
    { name: "SteadyLink Co.", flavor: "VPN provider. Users notice latency instantly." },
    { name: "CorePath Networks", flavor: "SD-WAN startup scaling fast. Needs bandwidth headroom." },
    { name: "BrightEdge Digital", flavor: "Digital marketing agency. Campaign dashboards can't go dark." },
    { name: "PrimeLine Hosting", flavor: "Hosting reseller. You're hosting their hosting." },
    { name: "AnchorPoint Data", flavor: "GIS analytics firm. Large dataset processing." },
  ],
  bandwidthRange: [20, 100],
  uptimeSla: 99.5,
  revenuePerMbps: 12,
  penaltyPerViolation: 500,
  durationMonths: [6, 12],
  isolationRequired: false,
};

const ENTERPRISE_TEMPLATE: ClientTemplate = {
  type: "enterprise",
  namePool: [
    { name: "Meridian Health", flavor: "Hospital chain. HIPAA compliance is non-negotiable." },
    { name: "Atlas Logistics", flavor: "Global shipping company. Their tracking system runs 24/7." },
    { name: "Vertex Media Group", flavor: "Streaming platform. Buffering costs them subscribers." },
    { name: "Ironclad Insurance", flavor: "Policy processing engine. Downtime means delayed claims." },
    { name: "Pinnacle Retail", flavor: "E-commerce platform. Black Friday traffic is the real test." },
    { name: "Stratos Aerospace", flavor: "Satellite telemetry processing. Data loss is unrecoverable." },
  ],
  bandwidthRange: [100, 500],
  uptimeSla: 99.9,
  revenuePerMbps: 10,
  penaltyPerViolation: 2000,
  durationMonths: [12, 24],
  isolationRequired: false,
};

const BANK_TEMPLATE: ClientTemplate = {
  type: "bank",
  namePool: [
    { name: "Northern Trust Bank", flavor: "Regional bank. Regulators audit their infrastructure quarterly." },
    { name: "ClearSettle Financial", flavor: "Payment processor. Every millisecond of latency costs money." },
    { name: "Granite Capital", flavor: "Hedge fund. Algorithmic trading needs dedicated, isolated compute." },
    { name: "SecureVault Payments", flavor: "PCI-DSS compliant payment gateway. Isolation mandatory." },
    { name: "Pacific Exchange Group", flavor: "Commodities exchange. Requires dedicated hardware." },
  ],
  bandwidthRange: [50, 200],
  uptimeSla: 99.99,
  revenuePerMbps: 20,
  penaltyPerViolation: 5000,
  durationMonths: [12, 36],
  isolationRequired: true,
};

const ALL_TEMPLATES = [STARTUP_TEMPLATE, SMB_TEMPLATE, ENTERPRISE_TEMPLATE, BANK_TEMPLATE];

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateProspect(
  reputation: number,
  tick: number,
  unlockedTiers: MilestoneState["unlockedClientTiers"],
  rng: () => number = Math.random,
): Client {
  // Filter to unlocked templates
  const available = ALL_TEMPLATES.filter((t) =>
    unlockedTiers.includes(t.type),
  );

  // Weighted selection based on reputation
  let template: ClientTemplate;
  const roll = rng();

  if (available.some((t) => t.type === "bank") && reputation >= 80 && roll < 0.15) {
    template = BANK_TEMPLATE;
  } else if (available.some((t) => t.type === "enterprise") && reputation >= 60 && roll < 0.3) {
    template = ENTERPRISE_TEMPLATE;
  } else if (available.some((t) => t.type === "smb") && (reputation >= 40 || roll > 0.6)) {
    template = SMB_TEMPLATE;
  } else {
    template = STARTUP_TEMPLATE;
  }

  const picked = pickRandom(template.namePool, rng);
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
    isolationRequired: template.isolationRequired,
    dedicatedHardware: template.type === "bank",
    monthlyRevenue: bandwidth * template.revenuePerMbps,
    penaltyPerViolation: template.penaltyPerViolation,
    durationMonths: duration,
  };

  return {
    id: `client-${crypto.randomUUID()}`,
    name: picked.name,
    type: template.type,
    contract,
    satisfaction: 100,
    status: "prospect",
    flavor: picked.flavor,
    prospectTick: tick,
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
