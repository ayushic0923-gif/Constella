// POST from Razorpay (no sign-in; verified by signature) — keeps each profile's
// subscription in step: renewals, failed payments, cancellations.
import { admin, env, hmacHex, json, sameText, toIso } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature") ?? "";
  const expected = await hmacHex(env("RAZORPAY_WEBHOOK_SECRET"), raw);
  if (!sameText(expected, signature)) return json({ error: "Signature mismatch." }, 400);

  let event: { event?: string; payload?: { subscription?: { entity?: Record<string, unknown> } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "Bad body." }, 400);
  }
  if (!event.event?.startsWith("subscription.")) return json({ ignored: event.event ?? "unknown" });

  const sub = event.payload?.subscription?.entity as
    | { id: string; status: string; current_end?: number | null; start_at?: number | null; notes?: { user_id?: string } }
    | undefined;
  if (!sub?.id) return json({ error: "No subscription in payload." }, 400);

  const db = admin();
  const update = { subscription_status: sub.status, current_period_end: toIso(sub.current_end ?? sub.start_at) };
  let { data } = await db.from("profiles").update(update).eq("razorpay_subscription_id", sub.id).select("id");
  // A subscription created from the dashboard carries the user in its notes.
  if (!data?.length && sub.notes?.user_id) {
    ({ data } = await db
      .from("profiles")
      .update({ ...update, razorpay_subscription_id: sub.id })
      .eq("id", sub.notes.user_id)
      .select("id"));
  }
  return json({ updated: data?.length ?? 0 });
});
