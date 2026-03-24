import type { GameState, QuestState, QuestStep } from "@downtime-ops/shared";

const FIRST_CONTRACT_STEPS: Array<Omit<QuestStep, "completed" | "completedAtTick">> = [
  {
    id: "buy_rack",
    title: "Order a Server Rack",
    description: "Walk to the staff computer in the datacenter and interact with it to open the browser. Click the Shop bookmark and purchase a 42U server rack. It will be delivered to the storage room.",
    hint: "Staff Computer → Shop",
  },
  {
    id: "place_rack",
    title: "Install the Rack",
    description: "Go to the storage room (door on the left) and pick up the rack package. Carry it back to the datacenter and drop it on one of the orange rack placement zones on the floor.",
    hint: "Storage Room → Datacenter floor",
  },
  {
    id: "buy_equipment",
    title: "Order Networking Gear",
    description: "Open the Shop again and buy three devices: a Router (handles internet traffic), a Switch (connects devices together), and a Server (hosts client workloads). All three are needed for a working network.",
    hint: "Shop — Equipment section",
  },
  {
    id: "install_router",
    title: "Install the Router",
    description: "Pick up the router from storage, carry it to the datacenter, and walk up to your rack. Press E to open the rack view, then drag the router from the inventory panel on the right into an empty slot.",
    hint: "Storage → Rack → drag into slot",
  },
  {
    id: "connect_uplink",
    title: "Connect the ISP Uplink",
    description: "Your router needs an internet connection. In the rack view, click the router's WAN port — it's the leftmost port with a blue label. This will plug in the ISP cable and give your network internet access.",
    hint: "Rack View — click WAN port (blue)",
  },
  {
    id: "install_switch",
    title: "Install the Switch",
    description: "Pick up the switch from storage and install it in the rack, just like you did with the router. The switch connects your router to your servers.",
    hint: "Storage → Rack → drag into slot",
  },
  {
    id: "install_server",
    title: "Install the Server",
    description: "Pick up the server from storage and install it in the rack. This is where PicoApp's workload will run.",
    hint: "Storage → Rack → drag into slot",
  },
  {
    id: "buy_cables",
    title: "Order Patch Cables",
    description: "Open the Shop and buy Cat6 patch cables. You'll need at least 2 — one to connect the router to the switch, and one to connect the switch to the server.",
    hint: "Shop — Cables section",
  },
  {
    id: "cable_router_switch",
    title: "Cable Router to Switch",
    description: "In the rack view, click one of the router's green LAN ports to pick up a cable end, then click any port on the switch to complete the connection. You'll see the cable appear between the devices.",
    hint: "Click LAN port → click switch port",
  },
  {
    id: "cable_switch_server",
    title: "Cable Switch to Server",
    description: "Connect the switch to the server the same way — click a switch port, then click a server port. Once connected, your network path is complete: Internet → Router → Switch → Server.",
    hint: "Click switch port → click server port",
  },
  {
    id: "accept_contract",
    title: "Accept PicoApp's Contract",
    description: "Walk to the staff computer and open the browser. Click the Clients bookmark to see waiting prospects. PicoApp is your first client — review their contract (10 Mbps, $150/mo) and click Accept Contract to start serving them.",
    hint: "Staff Computer → Browser → Clients",
  },
  {
    id: "first_revenue",
    title: "Earn Your First Payment",
    description: "With PicoApp active, traffic is now flowing through your network. Wait for the billing cycle to complete and you'll earn your first revenue. Watch the cables light up as data moves through your infrastructure!",
    hint: "Wait for billing cycle",
  },
];

export function createInitialQuests(): QuestState {
  return {
    quests: {
      first_contract: {
        id: "first_contract",
        title: "First Contract: PicoApp Hosting",
        description: "PicoApp, a two-person startup building a recipe app, needs hosting for their web service. Set up your datacenter infrastructure — rack, router, switch, server — cable it all together, and get them online.",
        giver: "PicoApp",
        status: "active",
        steps: FIRST_CONTRACT_STEPS.map((def) => ({
          ...def,
          completed: false,
          completedAtTick: null,
        })),
        currentStepIndex: 0,
      },
    },
    activeQuestId: "first_contract",
    tutorialComplete: false,
    networkReady: false,
    firstClientActivated: false,
    firstRevenueEarned: false,
  };
}

export function evaluateQuests(state: GameState): GameState {
  const qs = state.quests;
  if (qs.tutorialComplete) return state;

  const quest = qs.quests.first_contract;
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
  const links = Object.values(state.links);
  const clients = Object.values(state.clients);
  const items = Object.values(state.world.items);

  // --- World / shop steps ---

  // Buy rack: any rack item exists
  const hasRackItem = items.some((i) => i.kind === "rack");
  if (hasRackItem) complete("buy_rack");

  // Place rack: any rack is placed on the floor
  const hasPlacedRack = items.some((i) => i.kind === "rack" && i.state === "placed");
  if (hasPlacedRack) complete("place_rack");

  // Buy equipment: player has bought at least one of each device type
  const boughtModels = new Set(items.filter((i) => i.kind === "device").map((i) => i.model));
  const hasRouter = boughtModels.has("router_1u") || devices.some((d) => d.type === "router");
  const hasSwitch = boughtModels.has("switch_24p") || devices.some((d) => d.type === "switch");
  const hasServer = boughtModels.has("server_1u") || devices.some((d) => d.type === "server");
  if (hasRouter && hasSwitch && hasServer) complete("buy_equipment");

  // Install devices: check simulation-layer devices (exclude ISP demarc)
  if (devices.some((d) => d.type === "router" && d.id !== "device-isp-demarc")) complete("install_router");
  if (devices.some((d) => d.type === "switch")) complete("install_switch");
  if (devices.some((d) => d.type === "server")) complete("install_server");

  // Connect uplink: any uplink pointing to a router (not the demarc itself)
  const uplinkConnected = state.uplinks.some(
    (u) => u.deviceId !== "" && u.deviceId !== "device-isp-demarc",
  );
  if (uplinkConnected) complete("connect_uplink");

  // Buy cables: any cable stock > 0
  const cs = state.world.cableStock;
  if (cs.cat6 > 0 || cs.cat6a > 0 || cs.om3_fiber > 0 || cs.os2_fiber > 0) {
    complete("buy_cables");
  }

  // --- Network steps ---

  const hasRouterSwitchLink = links.some((link) => {
    const devA = state.devices[link.portA.deviceId];
    const devB = state.devices[link.portB.deviceId];
    if (!devA || !devB) return false;
    return (
      (devA.type === "router" && devB.type === "switch") ||
      (devA.type === "switch" && devB.type === "router")
    );
  });
  if (hasRouterSwitchLink) complete("cable_router_switch");

  const hasSwitchServerLink = links.some((link) => {
    const devA = state.devices[link.portA.deviceId];
    const devB = state.devices[link.portB.deviceId];
    if (!devA || !devB) return false;
    return (
      (devA.type === "switch" && devB.type === "server") ||
      (devA.type === "server" && devB.type === "switch")
    );
  });
  if (hasSwitchServerLink) complete("cable_switch_server");

  // --- Client / revenue steps ---

  const hasActiveClient = clients.some(
    (c) => c.status === "active" || c.status === "warning",
  );
  if (hasActiveClient) complete("accept_contract");

  let firstRevenueEarned = qs.firstRevenueEarned;
  if (!firstRevenueEarned && state.monthlyRevenue > 0) {
    firstRevenueEarned = true;
    complete("first_revenue");
  }

  // --- Compute derived flags ---

  const networkReady =
    hasRouterSwitchLink &&
    hasSwitchServerLink &&
    devices.some((d) => d.type === "router" && d.id !== "device-isp-demarc") &&
    devices.some((d) => d.type === "switch") &&
    devices.some((d) => d.type === "server");

  const firstClientActivated = qs.firstClientActivated || hasActiveClient;

  if (
    !changed &&
    firstRevenueEarned === qs.firstRevenueEarned &&
    networkReady === qs.networkReady &&
    firstClientActivated === qs.firstClientActivated
  ) {
    return state;
  }

  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const allComplete = steps.every((s) => s.completed);

  return {
    ...state,
    quests: {
      ...qs,
      quests: {
        ...qs.quests,
        first_contract: {
          ...quest,
          steps,
          currentStepIndex: currentStepIndex === -1 ? steps.length - 1 : currentStepIndex,
          status: allComplete ? "completed" : "active",
        },
      },
      tutorialComplete: allComplete,
      networkReady,
      firstClientActivated,
      firstRevenueEarned,
    },
  };
}
