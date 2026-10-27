import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTelemetry } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const payload = await getTelemetry(session);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
