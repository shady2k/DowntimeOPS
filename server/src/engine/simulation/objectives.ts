import type { GameState, TutorialState, ObjectiveId } from "@downtime-ops/shared";

const OBJECTIVE_DEFINITIONS = [
  { id: "buy_router", title: "Install a Router", description: "Buy a router to connect to the internet" },
  { id: "buy_switch", title: "Install a Switch", description: "Buy a switch to connect multiple devices" },
  { id: "buy_server", title: "Install a Server", description: "Buy a server to host client services" },
  { id: "connect_router_switch", title: "Connect Router to Switch", description: "Cable the router to the switch" },
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

  // Helper to complete an objective
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

  // Check device placement objectives
  if (devices.some((d) => d.type === "router")) complete("buy_router");
  if (devices.some((d) => d.type === "switch")) complete("buy_switch");
  if (devices.some((d) => d.type === "server")) complete("buy_server");

  // Check connection objectives - router connected to switch
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

  // Check switch-server connection
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

  // Check client accepted
  const hasActiveClient = clients.some(
    (c) => c.status === "active" || c.status === "warning",
  );
  if (hasActiveClient) complete("accept_client");

  // Check first revenue
  let firstRevenueEarned = tutorial.firstRevenueEarned;
  if (!firstRevenueEarned && state.monthlyRevenue > 0) {
    firstRevenueEarned = true;
    complete("first_revenue");
  }

  // Check network readiness
  const networkReady =
    hasRouterSwitchLink &&
    hasSwitchServerLink &&
    devices.some((d) => d.type === "router") &&
    devices.some((d) => d.type === "switch") &&
    devices.some((d) => d.type === "server");

  // Check first client activated (for gating failures)
  const firstClientActivated = tutorial.firstClientActivated || hasActiveClient;

  // survive_incident is completed when a port repair happens while clients are active.
  // That is tracked in the repairPort action handler, not here.

  if (
    !changed &&
    firstRevenueEarned === tutorial.firstRevenueEarned &&
    networkReady === tutorial.networkReady &&
    firstClientActivated === tutorial.firstClientActivated
  ) {
    return state;
  }

  // Find current objective index (first incomplete)
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
