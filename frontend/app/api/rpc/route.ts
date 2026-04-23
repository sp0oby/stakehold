import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bump the Vercel function duration past the Hobby default of 10s — a wide
// eth_getLogs can take 10-20s to come back, and getting killed mid-request
// makes the browser render empty state. 30s is the Hobby-plan cap.
export const maxDuration = 30;

/**
 * Server-side JSON-RPC proxy with upstream fallback chain.
 *
 * Why the fallback chain:
 *   A single keyed provider (Infura free tier) was rate-limiting the whole
 *   app once a real user spent more than a minute on the dashboard. Instead
 *   of paying for a bigger Infura plan just for a Sepolia demo, we point the
 *   proxy at a chain of free public Sepolia RPCs. If the first one 429s /
 *   5xxs / times out, we transparently try the next — the browser never sees
 *   the failure, and no provider needs to hold up the whole app on its own.
 *
 * Why proxy at all if the public RPCs don't need keys:
 *   1. Changing providers later is a single env var, not a redeploy of the
 *      entire client bundle.
 *   2. We keep the method denylist, body-size cap, and request-shape policing
 *      in one place.
 *   3. If you ever plug in a keyed provider (Alchemy, Infura paid), the key
 *      still stays server-side for free.
 *
 * Configuration:
 *   SEPOLIA_RPC_URLS  — comma-separated list, tried in order. Preferred.
 *   SEPOLIA_RPC_URL   — single URL, used as the first upstream if set.
 *   Defaults          — PublicNode, dRPC, Ankr, sepolia.org (all key-less).
 */

const DEFAULT_UPSTREAMS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://rpc.ankr.com/eth_sepolia",
  "https://rpc.sepolia.org",
];

function resolveUpstreams(): string[] {
  const list = process.env.SEPOLIA_RPC_URLS;
  if (list && list.trim().length > 0) {
    return list
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  const single =
    process.env.SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (single && single.trim().length > 0) {
    // Put the configured keyed provider first, public fallbacks after.
    return [single.trim(), ...DEFAULT_UPSTREAMS];
  }
  return DEFAULT_UPSTREAMS;
}

const UPSTREAMS = resolveUpstreams();

// Denylist: only block things that would be genuinely harmful. Everything
// else (including methods viem may add in future versions) is forwarded.
const BLOCKED_METHODS = new Set<string>([
  "eth_sendTransaction",
  "eth_sign",
  "eth_signTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v1",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_accounts",
  "eth_requestAccounts",
  "personal_sign",
  "personal_ecRecover",
  "personal_unlockAccount",
  "personal_importRawKey",
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_watchAsset",
  "wallet_requestPermissions",
  "wallet_getPermissions",
]);

const BLOCKED_PREFIXES = ["debug_", "trace_", "admin_", "miner_", "txpool_"];

const MAX_BODY_BYTES = 256 * 1024;

// Per-upstream timeout. We try up to UPSTREAMS.length providers, so this must
// be short enough that even the worst case (all fail) stays under maxDuration.
// With 4 upstreams and maxDuration=30s we budget 6s per attempt with headroom.
const PER_UPSTREAM_TIMEOUT_MS = 6_000;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
};

function rpcError(
  id: number | string | null | undefined,
  code: number,
  message: string
) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  };
}

function methodBlocked(method: string): boolean {
  if (BLOCKED_METHODS.has(method)) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (method.startsWith(prefix)) return true;
  }
  return false;
}

function screenCall(
  call: unknown
):
  | { ok: true }
  | { ok: false; method: string; id: number | string | null } {
  if (!call || typeof call !== "object") {
    return { ok: false, method: "invalid", id: null };
  }
  const method = (call as JsonRpcRequest).method;
  const id = (call as JsonRpcRequest).id ?? null;
  if (typeof method !== "string") {
    return { ok: false, method: "invalid", id };
  }
  if (methodBlocked(method)) {
    return { ok: false, method, id };
  }
  return { ok: true };
}

/**
 * POST to one upstream with a short timeout. Returns the upstream response
 * (and body text) on success, or `null` if this upstream failed in a way we
 * should fall through on (5xx, 429, network error, timeout). A 4xx that
 * isn't 429 is considered "real" — we return it instead of falling through.
 */
async function callUpstream(
  url: string,
  raw: string
): Promise<{ status: number; body: string; contentType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PER_UPSTREAM_TIMEOUT_MS
  );
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: raw,
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await res.text();
    // 429 and 5xx are "try the next upstream" signals. Everything else is
    // a real response that we should return as-is (including regular
    // JSON-RPC errors embedded in a 200).
    if (res.status === 429 || res.status >= 500) {
      // eslint-disable-next-line no-console
      console.warn(
        `[rpc] upstream ${new URL(url).host} returned ${res.status}, falling through`
      );
      return null;
    }
    return {
      status: res.status,
      body,
      contentType: res.headers.get("content-type") ?? "application/json",
    };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));
    // eslint-disable-next-line no-console
    console.warn(
      `[rpc] upstream ${new URL(url).host} failed (${aborted ? "timeout" : "network"}), falling through`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  if (UPSTREAMS.length === 0) {
    return NextResponse.json(
      rpcError(null, -32603, "RPC proxy is not configured on the server."),
      { status: 500 }
    );
  }

  // Cheap size guard before parsing.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return NextResponse.json(rpcError(null, -32600, "Request too large."), {
      status: 413,
    });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(rpcError(null, -32600, "Request too large."), {
      status: 413,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error."), {
      status: 400,
    });
  }

  const isBatch = Array.isArray(body);
  const calls = isBatch ? (body as unknown[]) : [body];
  if (calls.length === 0) {
    return NextResponse.json(rpcError(null, -32600, "Empty batch."), {
      status: 400,
    });
  }

  // Screen methods. If any are blocked, return a shape-preserving rejection
  // (batch-in → batch-out, singular-in → singular-out) so viem's transport
  // never reads `undefined` from a missing response slot.
  const blocked: {
    index: number;
    id: number | string | null;
    method: string;
  }[] = [];
  calls.forEach((call, index) => {
    const screened = screenCall(call);
    if (!screened.ok) {
      blocked.push({ index, id: screened.id, method: screened.method });
    }
  });

  if (blocked.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[rpc] blocked methods:",
      blocked.map((e) => e.method).join(", ")
    );
    if (isBatch) {
      const payload = calls.map((call, index) => {
        const err = blocked.find((e) => e.index === index);
        if (err) {
          return rpcError(
            err.id,
            -32601,
            `Method not allowed via proxy: ${err.method}`
          );
        }
        const c = call as JsonRpcRequest;
        return { jsonrpc: "2.0", id: c.id ?? null, result: null };
      });
      return NextResponse.json(payload, { status: 200 });
    }
    return NextResponse.json(
      rpcError(
        blocked[0].id,
        -32601,
        `Method not allowed via proxy: ${blocked[0].method}`
      ),
      { status: 400 }
    );
  }

  // Try each upstream in order. First one that answers with something other
  // than 429/5xx/timeout wins.
  for (const url of UPSTREAMS) {
    const result = await callUpstream(url, raw);
    if (result) {
      return new NextResponse(result.body, {
        status: result.status,
        headers: {
          "content-type": result.contentType,
          "cache-control": "no-store",
        },
      });
    }
  }

  // All upstreams failed. Return a clean JSON-RPC error so viem doesn't
  // crash trying to parse an HTML error page.
  // eslint-disable-next-line no-console
  console.error("[rpc] all upstreams failed");
  return NextResponse.json(
    rpcError(null, -32603, "All upstreams unavailable."),
    { status: 502 }
  );
}

export async function GET() {
  return NextResponse.json(rpcError(null, -32600, "Use POST."), {
    status: 405,
  });
}
