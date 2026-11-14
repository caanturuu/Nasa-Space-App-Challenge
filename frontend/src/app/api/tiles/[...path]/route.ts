/**
 * Tile proxy + in-memory cache for NASA Trek / ArcGIS raster layers.
 *
 * Why: the browser was hitting trek.nasa.gov directly, which is slow, rate
 * limited, and (for some zoom levels) blocked by CORS. Proxying through the
 * Next.js server gives us one cache, one origin, and no CORS surprises.
 *
 * Cache is a plain Map with LRU eviction — no Redis, no extra container.
 * It is lost on restart, which is fine for a demo.
 */

import { NextRequest, NextResponse } from "next/server";
import { NASA_LAYERS } from "@/lib/marsData";

const MAX_ENTRIES = 500;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedTile {
  body: ArrayBuffer;
  contentType: string;
  at: number;
}

const cache = new Map<string, CachedTile>();

function readCache(key: string): CachedTile | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU position.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function writeCache(key: string, tile: CachedTile) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, tile);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  if (!path || path.length !== 4) {
    return NextResponse.json({ error: "Expected /api/tiles/{layer}/{z}/{y}/{x}" }, { status: 400 });
  }

  const [layerId, z, y, x] = path;
  const layer = NASA_LAYERS.find((l) => l.id === layerId);
  const upstreamTemplate = layer?.upstreamTileUrl;
  if (!upstreamTemplate) {
    return NextResponse.json({ error: `Unknown tile layer "${layerId}"` }, { status: 404 });
  }

  const key = `${layerId}/${z}/${y}/${x}`;
  const cached = readCache(key);
  if (cached) {
    return new NextResponse(cached.body, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Tile-Cache": "hit",
      },
    });
  }

  const upstream = upstreamTemplate
    .replace("{z}", z)
    .replace("{y}", y)
    .replace("{x}", x);

  try {
    const res = await fetch(upstream, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream tile returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const body = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";
    writeCache(key, { body, contentType, at: Date.now() });

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Tile-Cache": "miss",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tile fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
