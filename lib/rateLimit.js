import { NextResponse } from "next/server";

// In-memory per-instance rate limiter. This resets whenever the serverless
// function cold-starts, so it's not a hard guarantee under heavy distributed
// abuse — but it stops runaway scripts/bots hitting these public endpoints,
// which is the realistic threat for a reception kiosk. If you outgrow this
// (e.g. you're getting hit from many IPs at once), swap in Upstash Redis
// (free tier) with @upstash/ratelimit — same call signature, durable store.
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20; // per IP, per route, per minute — generous for a real kiosk

export function checkRateLimit(req, routeKey) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const key = `${routeKey}:${ip}`;
  const now = Date.now();

  const entry = buckets.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    buckets.set(key, { start: now, count: 1 });
    return null;
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }
  return null;
}
