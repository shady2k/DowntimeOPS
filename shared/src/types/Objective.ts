export type ObjectiveId =
  | "visit_shop"
  | "buy_rack"
  | "place_rack"
  | "buy_equipment"
  | "install_router"
  | "install_switch"
  | "install_server"
  | "buy_cables"
  | "connect_router_switch"
  | "connect_switch_server"
  | "accept_client"
  | "first_revenue"
  | "survive_incident";

export interface Objective {
  id: ObjectiveId;
  title: string;
  description: string;
  completed: boolean;
  completedAtTick: number | null;
}

export interface TutorialState {
  objectives: Objective[];
  currentObjectiveIndex: number;
  tutorialComplete: boolean;
  firstClientActivated: boolean;
  firstRevenueEarned: boolean;
  networkReady: boolean;
}
