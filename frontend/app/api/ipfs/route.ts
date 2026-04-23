import { NextRequest, NextResponse } from "next/server";

// This route runs on the Node runtime (not Edge) so we can stream a
// multipart body upstream without buffering the entire file.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side IPFS pinning proxy (Filebase).
 *
 * Why Filebase: Pinata's free tier is too constrained for anything beyond a
 * single demo; Filebase gives us 5 GB / 1,000 pins on a free plan and exposes
 * an IPFS-compatible HTTP RPC that matches Pinata's multipart shape almost
 * exactly — so the swap is trivial. CIDs are content-addressed, so files
 * pinned here resolve through any public IPFS gateway.
 *
 * Security: FILEBASE_IPFS_TOKEN is a bucket-scoped access key read from the
 * server environment ONLY. Exposing it in the browser would let anyone pin
 * into your bucket or blow your quota.
 *
 * Flow:
 *   Browser --(multipart/form-data, file)-->  /api/ipfs
 *                                              |
 *                                              +-- Authorization: Bearer <token>
 *                                                  POST rpc.filebase.io/api/v0/add
 *                                                  ?pin=true&cid-version=1
 *                                              |
 *   Browser <-- { cid, gatewayUrl, size }  <-- { Hash, Size }
 */
export async function POST(req: NextRequest) {
  const token = process.env.FILEBASE_IPFS_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Upload service isn't configured. Set FILEBASE_IPFS_TOKEN on the server.",
      },
      { status: 500 }
    );
  }

  const incoming = (await req.formData()) as unknown as FormData;
  const file = incoming.get("file") as File | null;
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // Reject anything absurdly large server-side too (the dropzone caps at 10MB
  // client-side but a curl'd request could bypass that).
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (15 MB max)" }, { status: 413 });
  }

  const outbound = new FormData();
  outbound.append("file", file, file.name);

  let upstream: Response;
  try {
    upstream = await fetch(
      "https://rpc.filebase.io/api/v0/add?pin=true&cid-version=1",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: outbound,
      }
    );
  } catch (e) {
    const msg = (e as Error).message ?? "network error";
    return NextResponse.json(
      { error: `Upload service unreachable: ${msg}` },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    // Forward a cleaner message for the most common failure modes.
    let friendly = "Upload failed";
    if (upstream.status === 401 || upstream.status === 403) {
      friendly = "Upload service rejected credentials — contact the site admin.";
    } else if (upstream.status === 429) {
      friendly = "Upload service is rate-limited right now. Try again shortly.";
    } else if (upstream.status === 413) {
      friendly = "File is too large for the upload service.";
    }
    return NextResponse.json(
      { error: `${friendly} (${upstream.status}): ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  // Filebase returns newline-delimited JSON when multiple items are added.
  // With a single file, it's either a single JSON object or a one-line JSON.
  const raw = (await upstream.text()).trim();
  const firstLine = raw.split("\n")[0] ?? raw;
  let parsed: { Hash?: string; Size?: string; Name?: string };
  try {
    parsed = JSON.parse(firstLine);
  } catch {
    return NextResponse.json(
      { error: "Upload service returned an unparseable response." },
      { status: 502 }
    );
  }

  const cid = parsed.Hash;
  if (!cid) {
    return NextResponse.json(
      { error: "Upload service response missing a CID." },
      { status: 502 }
    );
  }

  const gateway = process.env.IPFS_GATEWAY ?? "https://ipfs.filebase.io/ipfs/";
  const gatewayUrl = `${gateway.replace(/\/$/, "/")}${cid}`;

  return NextResponse.json({
    cid,
    gatewayUrl,
    size: Number(parsed.Size ?? 0),
  });
}
