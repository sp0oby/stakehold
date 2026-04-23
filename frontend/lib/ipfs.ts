/**
 * IPFS helpers.
 *
 * Centralizing the gateway keeps the UI provider-agnostic: files are pinned
 * through Filebase on the server, but any public IPFS gateway resolves them.
 * The default is Filebase's owned gateway, which tends to be fastest for
 * content they pin; override with `NEXT_PUBLIC_IPFS_GATEWAY` to use
 * `dweb.link`, `w3s.link`, a paid gateway, or a self-hosted one.
 */
const DEFAULT_GATEWAY = "https://ipfs.filebase.io/ipfs/";

const RAW_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || DEFAULT_GATEWAY;

const GATEWAY = RAW_GATEWAY.endsWith("/") ? RAW_GATEWAY : `${RAW_GATEWAY}/`;

/** Returns true if the URI is an `ipfs://` or `ipfs:/` pointer. */
export function isIpfsUri(uri: string | undefined | null): uri is string {
  if (!uri) return false;
  return uri.startsWith("ipfs://") || uri.startsWith("ipfs:/");
}

/**
 * Extract the CID portion from an IPFS URI or return the string itself if it
 * already looks like a bare CID. Returns null for http(s) URLs and empties.
 */
function extractCid(uri: string | undefined | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return null;
  if (uri.startsWith("ipfs://")) return uri.slice("ipfs://".length);
  if (uri.startsWith("ipfs:/")) return uri.slice("ipfs:/".length);
  return uri;
}

/**
 * Conservative "does this look like a real CID?" check.
 *
 * Real CIDs are either CIDv0 (`Qm...`, 46 chars of base58) or CIDv1 (usually
 * `bafy...`/`bafk...`, 59 chars of base32). We reject anything shorter than
 * 46 characters to filter out demo placeholders like `bafkreigenesislegal`
 * (20 chars) that would otherwise 404 the user on the gateway.
 */
export function isLikelyCid(uri: string | undefined | null): boolean {
  const cid = extractCid(uri);
  if (!cid) return false;
  if (cid.length < 46) return false;
  if (cid.startsWith("Qm")) return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
  return /^[a-z2-7]{46,}$/.test(cid);
}

/**
 * Returns true if the URI is present but doesn't point at something a user
 * could actually fetch — handy for rendering a "coming soon" state instead
 * of a link that will 404.
 */
export function isResolvableIpfs(uri: string | undefined | null): boolean {
  if (!uri) return false;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return true;
  return isLikelyCid(uri);
}

/**
 * Resolve an IPFS URI or raw CID to a browser-fetchable HTTPS URL through the
 * configured gateway. Passes through HTTP(S) URLs unchanged so callers don't
 * need to branch.
 */
export function resolveIpfs(uri: string | undefined | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  if (uri.startsWith("ipfs://")) return `${GATEWAY}${uri.slice("ipfs://".length)}`;
  if (uri.startsWith("ipfs:/")) return `${GATEWAY}${uri.slice("ipfs:/".length)}`;
  // Assume a bare CID.
  if (/^[a-zA-Z0-9]{40,}$/.test(uri)) return `${GATEWAY}${uri}`;
  return uri;
}

/** The gateway prefix in use, useful for debug UI. */
export const ipfsGateway = GATEWAY;
