import type { GameState, QuestStep, InterfaceConfig } from "@downtime-ops/shared";

export const NETWORK_FUNDAMENTALS_STEPS: Array<Omit<QuestStep, "completed" | "completedAtTick">> = [
  {
    id: "nf_open_console",
    title: "Open a Device Console",
    description: "In the rack view, click the console icon on your router to open its management page. This is where you configure device network settings.",
    hint: "Rack View → click router console",
  },
  {
    id: "nf_configure_router_lan",
    title: "Configure Router LAN Interface",
    description: "On the router management page, eth0 is your WAN uplink — don't touch it. Click Edit on eth1 (a LAN port) and set its IP to 10.0.1.1 with mask /24. This will be the gateway for your server subnet.",
    hint: "Router console → Interfaces → eth1 → Edit → set IP",
  },
  {
    id: "nf_configure_server",
    title: "Configure Server Network",
    description: "Click the CON port on the server to open its management page. Go to the Network tab and set IP to 10.0.1.10, mask /24, and gateway to 10.0.1.1 (your router's LAN IP).",
    hint: "Server CON port → Network → set IP/gateway",
  },
  {
    id: "nf_check_ipam",
    title: "Verify in IPAM",
    description: "Open the IPAM page in the browser. You should see your 10.0.1.0/24 subnet automatically discovered with both the router and server listed. IPAM auto-discovers all configured IPs.",
    hint: "Browser → IPAM",
  },
  {
    id: "nf_accept_second_client",
    title: "Accept a Second Client",
    description: "Go to the Contracts page and accept any prospect — it doesn't matter which one. Having two active clients proves your network can handle multiple tenants.",
    hint: "Browser → Contracts → Accept any",
  },
];

export function evaluateNetworkFundamentals(state: GameState): GameState {
  const qs = state.quests;
  const quest = qs.quests.network_fundamentals;
  if (!quest || quest.status === "completed") return state;

  const steps = quest.steps.map((s) => ({ ...s }));
  let changed = false;

  const complete = (id: string) => {
    const step = steps.find((s) => s.id === id);
    if (step && !step.completed) {
      step.completed = true;
      step.completedAtTick = state.tick;
      changed = true;
    }
  };

  const devices = Object.values(state.devices);
  const clients = Object.values(state.clients);

  // Open console: player visited any device console page
  if (qs.visitedPages.includes("console")) complete("nf_open_console");

  // Configure router LAN: any router (non-demarc) has an interface (not port 0/WAN)
  // with a manually-set IP
  for (const dev of devices) {
    if (dev.type !== "router" || dev.id === "device-isp-demarc") continue;
    const cfg = dev.config as { interfaces: Record<number, InterfaceConfig> };
    for (const [portIdx, iface] of Object.entries(cfg.interfaces)) {
      if (Number(portIdx) === 0) continue; // skip WAN
      if (iface.ip && iface.mask !== null) {
        complete("nf_configure_router_lan");
        break;
      }
    }
  }

  // Configure server: any server with a non-default IP (not 10.0.0.x auto-assigned)
  // and a gateway set
  for (const dev of devices) {
    if (dev.type !== "server") continue;
    const cfg = dev.config as { ip: string | null; mask: number | null; gateway: string | null };
    if (cfg.ip && cfg.gateway && cfg.mask !== null) {
      if (!cfg.ip.startsWith("10.0.0.")) {
        complete("nf_configure_server");
      }
    }
  }

  // Check IPAM: player visited the IPAM page
  if (qs.visitedPages.includes("ipam")) complete("nf_check_ipam");

  // Accept second client: 2+ active/provisioning/warning clients
  const acceptedCount = clients.filter(
    (c) => c.status === "provisioning" || c.status === "active" || c.status === "warning",
  ).length;
  if (acceptedCount >= 2) complete("nf_accept_second_client");

  if (!changed) return state;

  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const allComplete = steps.every((s) => s.completed);

  return {
    ...state,
    quests: {
      ...qs,
      quests: {
        ...qs.quests,
        network_fundamentals: {
          ...quest,
          steps,
          currentStepIndex: currentStepIndex === -1 ? steps.length - 1 : currentStepIndex,
          status: allComplete ? "completed" : "active",
        },
      },
    },
  };
}
