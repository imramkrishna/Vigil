import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "169.254.169.254",
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((n) => Number(n));
  return (
    (((parts[0] ?? 0) << 24) >>> 0) +
    (((parts[1] ?? 0) << 16) >>> 0) +
    (((parts[2] ?? 0) << 8) >>> 0) +
    ((parts[3] ?? 0) >>> 0)
  );
}

function inCidr4(ip: string, base: string, prefixLen: number): boolean {
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/**
 * Returns true if an IPv4 or IPv6 address belongs to loopback, private RFC-1918,
 * link-local / cloud metadata (169.254.0.0/16), CGNAT, or ULA ranges.
 */
export function isBlockedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  const version = net.isIP(ip);

  if (version === 4) {
    return (
      inCidr4(ip, "0.0.0.0", 8) || // Current network
      inCidr4(ip, "10.0.0.0", 8) || // RFC-1918
      inCidr4(ip, "100.64.0.0", 10) || // CGNAT
      inCidr4(ip, "127.0.0.0", 8) || // Loopback
      inCidr4(ip, "169.254.0.0", 16) || // Link-local & Cloud Metadata
      inCidr4(ip, "172.16.0.0", 12) || // RFC-1918
      inCidr4(ip, "192.168.0.0", 16) || // RFC-1918
      inCidr4(ip, "224.0.0.0", 4) || // Multicast
      inCidr4(ip, "240.0.0.0", 4) // Reserved
    );
  }

  if (version === 6) {
    if (ip === "::" || ip === "::1") return true;
    // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254)
    if (ip.startsWith("::ffff:")) {
      const mapped = ip.slice("::ffff:".length);
      if (net.isIP(mapped) === 4) {
        return isBlockedIp(mapped);
      }
      // Hex form e.g. ::ffff:7f00:1 or ::ffff:a9fe:a9fe
      const hexParts = mapped.split(":");
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0]!, 16);
        const lo = parseInt(hexParts[1]!, 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isBlockedIp(v4);
        }
      }
    }
    // Unique Local Addresses (fc00::/7 -> fc.. or fd..)
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
    // Link-local (fe80::/10 -> fe8., fe9., fea., feb.)
    if (/^fe[89ab]/.test(ip)) return true;
    // Multicast (ff00::/8)
    if (ip.startsWith("ff")) return true;
    return false;
  }

  // Anything not a valid IP is treated as unsafe
  return true;
}

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Validates that a user-supplied URL is HTTP(S), does not target internal/metadata
 * hostnames, and resolves exclusively to public routable IP addresses.
 */
export async function assertSafeExternalUrl(
  rawUrl: string,
  options?: { skipDnsLookup?: boolean }
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Invalid URL format.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new SsrfBlockedError(
      `Unsupported URL protocol "${parsed.protocol}". Only http and https are allowed.`
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    throw new SsrfBlockedError("URL hostname is required.");
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    throw new SsrfBlockedError(
      `Blocked internal or metadata hostname: "${hostname}".`
    );
  }

  if (net.isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) {
      throw new SsrfBlockedError(
        `Blocked private, loopback, or metadata IP address: "${hostname}".`
      );
    }
    return parsed;
  }

  if (options?.skipDnsLookup) {
    return parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfBlockedError(`Could not resolve hostname "${hostname}".`);
  }

  if (!addresses || addresses.length === 0) {
    throw new SsrfBlockedError(`Hostname "${hostname}" resolved to no addresses.`);
  }

  for (const record of addresses) {
    if (isBlockedIp(record.address)) {
      throw new SsrfBlockedError(
        `Hostname "${hostname}" resolves to a blocked internal/metadata IP (${record.address}).`
      );
    }
  }

  return parsed;
}
