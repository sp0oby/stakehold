import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bump the Vercel function duration past the Hobby-plan default of 10s —
// eth_getLogs over wide ranges routinely takes 12-20s to come back from
// Infura, and if the function is killed mid-request the browser sees a
// timeout and silently renders empty state. 30s is the Hobby-plan cap.
export const maxDuration = 30;

/**
 * Server-side JSON-RPC proxy.
 *
 * Why this exists:
 *   Before: the browser called `https://sepolia.infura.io/v3/<key>` directly,
 *   which meant the key was embedded in every request and visible in DevTools.
 *   Anyone could copy it and burn through the quota, triggering 429s for real
 *   users.
 *
 *   After: the browser calls `/api/rpc` on our own origin. This route runs on
 *   the server (Vercel Function), reads the real upstream URL from a
 *   non-public env var, and forwards the JSON-RPC body. The upstream key never
 *   reaches the client.
 *
 * Hardening:
 *   - Only POST is accepted (JSON-RPC over HTTP is POST).
 *   - Method DENYLIST: wallet/signing and expensive debug/trace methods are
 *     rejected. Everything else (all standard read methods, plus niche ones
 *     like eth_getProof that future viem versions may call) is forwarded.
 *     We prefer a denylist over an allowlist because viem/wagmi expand the
 *     set of methods they use between versions, and a tight allowlist breaks
 *     the UI without actually improving security — Infura doesn't have a
 *     wallet, so most "dangerous" methods would fail upstream anyway.
 *   - Batch requests are supported; every entry in the batch is screened.
 *   - Body size cap prevents log-query DoS.
 *   - Short upstream timeout so a slow provider can't pin a function instance.
 */

const UPSTREAM_URL =
  process.env.SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "";

// Explicit methods that are always blocked. Most of these would fail upstream
// anyway (Infura doesn't hold keys), but blocking them here is cheaper and
// makes the policy explicit.
const BLOCKED_METHODS = new Set<string>([
  // Signing / wallet — no server-side wallet exists.
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
  // Wallet RPCs live in the user's wallet, not in a provider.
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_watchAsset",
  "wallet_requestPermissions",
  "wallet_getPermissions",
]);

// Prefixes for whole method families that are expensive or privileged.
// Anything starting with one of these is rejected.
const BLOCKED_PREFIXES = ["debug_", "trace_", "admin_", "miner_", "txpool_"];

// 256 KB is plenty for any legit JSON-RPC call (even a fat eth_getLogs).
const MAX_BODY_BYTES = 256 * 1024;

// Slightly below maxDuration so we respond with a proper JSON-RPC error
// rather than Vercel's 504 page when upstream is slow.
const UPSTREAM_TIMEOUT_MS = 25_000;

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

function screenCall(call: unknown): { ok: true } | { ok: false; method: string; id: number | string | null } {
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

export async function POST(req: NextRequest) {
  if (!UPSTREAM_URL) {
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

  // Screen every call. If any are blocked, respond in the SAME shape as the
  // incoming request — batch input gets a batch-shaped response with one
  // entry per call, singular input gets a singular response. Returning a
  // singular error for a batched request was what caused viem's transport
  // to read `undefined` from response slots and crash with
  // "Cannot read properties of undefined (reading 'map')".
  const errors: { index: number; id: number | string | null; method: string }[] = [];
  calls.forEach((call, index) => {
    const screened = screenCall(call);
    if (!screened.ok) {
      errors.push({ index, id: screened.id, method: screened.method });
    }
  });

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[rpc] blocked methods:",
      errors.map((e) => e.method).join(", ")
    );
    if (isBatch) {
      const payload = calls.map((call, index) => {
        const err = errors.find((e) => e.index === index);
        if (err) {
          return rpcError(
            err.id,
            -32601,
            `Method not allowed via proxy: ${err.method}`
          );
        }
        // For calls in the batch that would have succeeded, return a
        // benign null result; the whole batch is being rejected, but at
        // least the shape viem expects is preserved.
        const c = call as JsonRpcRequest;
        return { jsonrpc: "2.0", id: c.id ?? null, result: null };
      });
      return NextResponse.json(payload, { status: 200 });
    }
    return NextResponse.json(
      rpcError(
        errors[0].id,
        -32601,
        `Method not allowed via proxy: ${errors[0].method}`
      ),
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: raw,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();

    // Propagate upstream status (incl. 429) so react-query backs off naturally
    // instead of hammering. Strip headers that leak the upstream identity.
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));
    return NextResponse.json(
      rpcError(null, -32603, aborted ? "Upstream timeout." : "Upstream error."),
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  return NextResponse.json(rpcError(null, -32600, "Use POST."), {
    status: 405,
  });
}
