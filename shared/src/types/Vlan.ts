import type { Subnet } from "./Subnet";

export interface Vlan {
  id: number;
  name: string;
  color: string;
  subnet: Subnet | null;
}
