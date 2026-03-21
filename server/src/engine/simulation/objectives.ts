import type { GameState, TutorialState, ObjectiveId } from "@downtime-ops/shared";

const OBJECTIVE_DEFINITIONS = [
  { id: "visit_shop", title: "Visit the Shop", description: "Use the computer in the datacenter to open the shop" },
  { id: "buy_rack", title: "Buy a Rack", description: "Order a 42U server rack from the shop" },
  { id: "place_rack", title: "Place the Rack", description: "Pick up the rack from storage and place it in the datacenter" },
  { id: "buy_equipment", title: "Buy Equipment", description: "Order a router, switch, and server from the shop" },
  { id: "install_router", title: "Install the Router", description: "Carry the router to the rack and install it" },
  { id: "install_switch", title: "Install the Switch", description: "Install the switch in the rack" },
  { id: "install_server", title: "Install the Server", description: "Install the server in the rack" },
  { id: "buy_cables", title: "Buy Cables", description: "Order Cat6 patch cables from the shop" },
  { id: "connect_router_switch", title: "Connect Router to Switch", description: "Open the rack and cable the router to the switch" },
  { id: "connect_switch_server", title: "Connect Switch to Server", description: "Cable the switch to the server" },
  { id: "accept_client", title: "Accept a Client", description: "Accept a hosting contract to start earning revenue" },
  { id: "first_revenue", title: "Earn Revenue", description: "Complete a billing cycle with an active client" },
  { id: "survive_incident", title: "Survive an Incident", description: "Fix a port failure and restore service" },
] as const;

export function createInitialTutorial(): TutorialState {
  return {
    objectives: OBJECTIVE_DEFINITIONS.map((def) => ({
      id: def.id as ObjectiveId,
      title: def.title,
      description: def.description,
      completed: false,
      completedAtTick: null,
    })),
    currentObjectiveIndex: 0,
    tutorialComplete: false,
    firstClientActivated: false,
    firstRevenueEarned: false,
    networkReady: false,
  };
}

export function evaluateObjectives(state: GameState): GameState {
  const tutorial = state.tutorial;
  if (tutorial.tutorialComplete) return state;

  const objectives = [...tutorial.objectives.map((o) => ({ ...o }))];
  let changed = false;

  const complete = (id: string) => {
    const obj = objectives.find((o) => o.id === id);
    if (obj && !obj.completed) {
      obj.completed = true;
      obj.completedAtTick = state.tick;
      changed = true;
    }
  };

  const devices = Object.values(state.devices);
  const links = Object.values(state.links);
  const clients = Object.values(state.clients);
  const items = Object.values(state.world.items);

  // --- World / shop objectives ---

  // Visit shop: player has opened the shop at least once (any listing exists = shop was created)
  // We detect this by checking if any item was ever purchased or if storage has had packages
  const hasEverBought = items.length > 0;
  if (hasEverBought) complete("visit_shop");

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

  // Install devices: check simulation-layer devices
  if (devices.some((d) => d.type === "router")) complete("install_router");
  if (devices.some((d) => d.type === "switch")) complete("install_switch");
  if (devices.some((d) => d.type === "server")) complete("install_server");

  // Buy cables: any cable stock > 0
  const cs = state.world.cableStock;
  if (cs.cat6 > 0 || cs.cat6a > 0 || cs.om3_fiber > 0 || cs.os2_fiber > 0) {
    complete("buy_cables");
  }

  // --- Network objectives ---

  const hasRouterSwitchLink = links.some((link) => {
    const devA = state.devices[link.portA.deviceId];
    const devB = state.devices[link.portB.deviceId];
    if (!devA || !devB) return false;
    return (
      (devA.type === "router" && devB.type === "switch") ||
      (devA.type === "switch" && devB.type === "router")
    );
  });
  if (hasRouterSwitchLink) complete("connect_router_switch");

  const hasSwitchServerLink = links.some((link) => {
    const devA = state.devices[link.portA.deviceId];
    const devB = state.devices[link.portB.deviceId];
    if (!devA || !devB) return false;
    return (
      (devA.type === "switch" && devB.type === "server") ||
      (devA.type === "server" && devB.type === "switch")
    );
  });
  if (hasSwitchServerLink) complete("connect_switch_server");

  // --- Client / revenue objectives ---

  const hasActiveClient = clients.some(
    (c) => c.status === "active" || c.status === "warning",
  );
  if (hasActiveClient) complete("accept_client");

  let firstRevenueEarned = tutorial.firstRevenueEarned;
  if (!firstRevenueEarned && state.monthlyRevenue > 0) {
    firstRevenueEarned = true;
    complete("first_revenue");
  }

  // survive_incident is completed in the repairPort action handler

  const networkReady =
    hasRouterSwitchLink &&
    hasSwitchServerLink &&
    devices.some((d) => d.type === "router") &&
    devices.some((d) => d.type === "switch") &&
    devices.some((d) => d.type === "server");

  const firstClientActivated = tutorial.firstClientActivated || hasActiveClient;

  if (
    !changed &&
    firstRevenueEarned === tutorial.firstRevenueEarned &&
    networkReady === tutorial.networkReady &&
    firstClientActivated === tutorial.firstClientActivated
  ) {
    return state;
  }

  const currentObjectiveIndex = objectives.findIndex((o) => !o.completed);
  const tutorialComplete = objectives.every((o) => o.completed);

  return {
    ...state,
    tutorial: {
      objectives,
      currentObjectiveIndex:
        currentObjectiveIndex === -1
          ? objectives.length - 1
          : currentObjectiveIndex,
      tutorialComplete,
      firstClientActivated,
      firstRevenueEarned,
      networkReady,
    },
  };
}
