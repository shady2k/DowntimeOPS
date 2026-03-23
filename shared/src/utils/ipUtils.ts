/** IP math utilities — shared between engine validation and client display */

export function isValidIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

export function ipToInt(ip: string): number {
  const parts = ip.split(".");
  return ((Number(parts[0]) << 24) | (Number(parts[1]) << 16) | (Number(parts[2]) << 8) | Number(parts[3])) >>> 0;
}

export function intToIp(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

export function networkAddress(ip: string, mask: number): string {
  const maskBits = mask === 0 ? 0 : (0xffffffff << (32 - mask)) >>> 0;
  return intToIp((ipToInt(ip) & maskBits) >>> 0);
}

export function broadcastAddress(network: string, mask: number): string {
  const hostBits = mask === 32 ? 0 : (0xffffffff >>> mask);
  return intToIp((ipToInt(network) | hostBits) >>> 0);
}

/** Usable host count for a given prefix length */
export function hostCount(mask: number): number {
  if (mask >= 32) return 1;
  if (mask === 31) return 2;
  return Math.pow(2, 32 - mask) - 2;
}

export function isIpInSubnet(ip: string, network: string, mask: number): boolean {
  return networkAddress(ip, mask) === network;
}

export function isNetworkAddress(ip: string, mask: number): boolean {
  return networkAddress(ip, mask) === ip;
}

export function isBroadcastAddress(ip: string, network: string, mask: number): boolean {
  if (mask >= 31) return false; // /31 and /32 have no broadcast
  return ip === broadcastAddress(network, mask);
}

export function subnetsOverlap(
  netA: string, maskA: number,
  netB: string, maskB: number,
): boolean {
  const startA = ipToInt(netA);
  const endA = (startA | ((maskA === 32 ? 0 : (0xffffffff >>> maskA)))) >>> 0;
  const startB = ipToInt(netB);
  const endB = (startB | ((maskB === 32 ? 0 : (0xffffffff >>> maskB)))) >>> 0;
  return startA <= endB && startB <= endA;
}
