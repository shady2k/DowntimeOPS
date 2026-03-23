export interface IpamAllocation {
  ip: string;
  deviceId: string | null;
  description: string;
}

export interface IpamSubnet {
  id: string;
  network: string;
  mask: number;
  name: string;
  vlanId: number | null;
  allocations: Record<string, IpamAllocation>;
}

export interface IpamState {
  subnets: Record<string, IpamSubnet>;
}
