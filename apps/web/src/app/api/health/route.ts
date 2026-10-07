import { sql } from "@denkraum/db";
import { getDb } from "@/lib/db.ts";

export const dynamic = "force-dynamic";

/** For the container health check: the app answers and the database is reachable. */
export async function GET(): Promise<Response> {
  try {
    await (await getDb()).execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
