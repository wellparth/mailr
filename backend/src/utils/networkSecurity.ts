import dns from 'dns';

/**
 * Validates destination host and port for outbound mail service connections.
 * Protects against Server-Side Request Forgery (SSRF) and internal port scanning.
 */
export async function validateMailDestination(host: string, port: number | string): Promise<void> {
  const numericPort = Number(port);
  const allowedPorts = [993, 465, 587, 143, 25, 2525];

  if (!numericPort || !allowedPorts.includes(numericPort)) {
    throw new Error(
      `Port ${port} is not an allowed mail service port. Permitted ports: ${allowedPorts.join(', ')}`
    );
  }

  if (!host || typeof host !== 'string') {
    throw new Error('Host is required');
  }

  const cleanHost = host.trim().toLowerCase();

  // Reject obvious local, internal, and link-local hostnames
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.lan') ||
    cleanHost.endsWith('.home')
  ) {
    throw new Error('Connections to local, loopback, and internal hostnames are prohibited.');
  }

  // Resolve hostname via DNS and check all resolved IPs
  let addresses: dns.LookupAddress[] = [];
  try {
    addresses = await dns.promises.lookup(cleanHost, { all: true });
  } catch {
    throw new Error(`Failed to resolve destination mail host: ${cleanHost}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`Host did not resolve to any network addresses: ${cleanHost}`);
  }

  for (const { address, family } of addresses) {
    if (isPrivateOrReservedIp(address, family)) {
      throw new Error(
        `Destination address resolves to a restricted or private network IP (${cleanHost} -> ${address}). Outbound connection blocked.`
      );
    }
  }
}

/**
 * Checks whether an IP address belongs to loopback, private (RFC 1918),
 * link-local (169.254.0.0/16 cloud metadata), or multicast/reserved ranges.
 */
export function isPrivateOrReservedIp(ip: string, family: number): boolean {
  if (family === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [b0, b1] = parts;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 10.0.0.0/8 (RFC 1918 Private)
    if (b0 === 10) return true;
    // 172.16.0.0/12 (RFC 1918 Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (RFC 1918 Private)
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (Link-local / AWS / GCP / Azure Instance Metadata)
    if (b0 === 169 && b1 === 254) return true;
    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;
    if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;
    if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (b0 >= 224) return true;

    return false;
  } else if (family === 6) {
    const clean = ip.toLowerCase();
    // ::1 or :: (Loopback)
    if (clean === '::1' || clean === '::') return true;
    // fe80::/10 (Link-local)
    if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
      return true;
    }
    // fc00::/7 (Unique local address)
    if (clean.startsWith('fc') || clean.startsWith('fd')) {
      return true;
    }
    // IPv4-mapped IPv6 address (::ffff:x.x.x.x)
    if (clean.startsWith('::ffff:')) {
      const v4 = clean.replace('::ffff:', '');
      return isPrivateOrReservedIp(v4, 4);
    }
    return false;
  }
  return true;
}
