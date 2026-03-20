import type { Rack } from "./Rack";
import type { Device } from "./Device";
import type { Link } from "./Link";
import type { Vlan } from "./Vlan";
import type { Route } from "./Route";
import type { FirewallRule } from "./FirewallRule";
import type { Client } from "./Client";
import type { Connection } from "./Connection";
import type { Alert, LogEntry, Uplink } from "./Common";
import type { TutorialState } from "./Objective";
import type { MilestoneState } from "./Milestone";

export interface GameState {
  tick: number;
  speed: number;
  money: number;
  reputation: number;
  phase: number;

  racks: Record<string, Rack>;
  devices: Record<string, Device>;
  links: Record<string, Link>;
  vlans: Record<number, Vlan>;
  routes: Route[];
  firewallRules: FirewallRule[];
  clients: Record<string, Client>;
  connections: Record<string, Connection>;

  alerts: Alert[];
  log: LogEntry[];

  uplinks: Uplink[];
  monthlyExpenses: number;
  monthlyRevenue: number;

  tutorial: TutorialState;
  progression: MilestoneState;
}
