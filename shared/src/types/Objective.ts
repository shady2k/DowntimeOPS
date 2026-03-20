export type ObjectiveId =
  | "buy_router"
  | "buy_switch"
  | "buy_server"
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
