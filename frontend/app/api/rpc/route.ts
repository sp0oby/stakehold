import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 *   - Method allowlist: only read methods + raw tx broadcast are forwarded.
 *     Wallet / admin methods (eth_accounts, eth_sendTransaction, personal_*,
 *     debug_*, etc.) are rejected. The user's wallet handles signing locally.
 *   - Batch requests are supported but every entry in the batch must pass the
 *     allowlist, otherwise the whole batch is rejected.
 *   - Body size cap prevents log-query DoS.
 *   - Short upstream timeout so a slow provider can't pin a function instance.
 */

const UPSTREAM_URL =
  process.env.SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "";

// Methods we allow the browser to invoke via the proxy. Anything not on this
// list is rejected with a JSON-RPC error — including signing and admin calls.
const ALLOWED_METHODS = new Set<string>([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_getLogs",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_maxPriorityFeePerGas",
  "eth_sendRawTransaction",
  "eth_syncing",
  "net_version",
  "net_listening",
  "web3_clientVersion",
]);

// 256 KB is plenty for any legit JSON-RPC call (even a fat eth_getLogs).
// Anything larger is almost certainly abuse.
const MAX_BODY_BYTES = 256 * 1024;

// Keep upstream calls snappy so we don't hold a serverless instance open.
const UPSTREAM_TIMEOUT_MS = 15_000;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
};

function rpcError(id: number | string | null | undefined, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  };
}

function methodAllowed(call: unknown): call is JsonRpcRequest {
  if (!call || typeof call !== "object") return false;
  const method = (call as JsonRpcRequest).method;
  return typeof method === "string" && ALLOWED_METHODS.has(method);
}

export async function POST(req: NextRequest) {
  if (!UPSTREAM_URL) {
    return NextResponse.json(
      rpcError(null, -32603, "RPC proxy is not configured on the server."),
      { status: 500 }
    );
  }

  // Cheap size guard before we even parse JSON.
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

  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0) {
    return NextResponse.json(rpcError(null, -32600, "Empty batch."), {
      status: 400,
    });
  }

  for (const call of calls) {
    if (!methodAllowed(call)) {
      const id = (call as JsonRpcRequest)?.id ?? null;
      const method = (call as JsonRpcRequest)?.method ?? "unknown";
      return NextResponse.json(
        rpcError(id, -32601, `Method not allowed via proxy: ${method}`),
        { status: 400 }
      );
    }
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

    // If upstream rate-limits us, propagate it so react-query backs off
    // instead of hammering. We still strip any Retry-After that leaks the
    // upstream identity.
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
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    return NextResponse.json(
      rpcError(null, -32603, aborted ? "Upstream timeout." : "Upstream error."),
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Block other verbs — browsers sometimes send OPTIONS preflights; same-origin
// fetches from the app don't need CORS, and we don't want to whitelist other
// origins to this proxy.
export async function GET() {
  return NextResponse.json(rpcError(null, -32600, "Use POST."), { status: 405 });
}
