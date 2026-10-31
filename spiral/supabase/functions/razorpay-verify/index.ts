// POST — after Razorpay Checkout succeeds: check its signature, read the
// subscription back from Razorpay, and record it on the person's profile.
import { admin, caller, cors, env, hmacHex, json, razorpay, sameText, toIso } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const user = await caller(req);
    if (!user) return json({ error: "Sign in first." }, 401);
    const { razorpay_payment_id: paymentId, razorpay_subscription_id: subId, razorpay_signature: signature } = await req.json();
    if (!paymentId || !subId || !signature) return json({ error: "Missing payment details." }, 400);

    const db = admin();
    const { data: profile } = await db.from("profiles").select("razorpay_subscription_id").eq("id", user.id).single();
    if (!profile || profile.razorpay_subscription_id !== subId) return json({ error: "That subscription isn't yours." }, 403);

    // Razorpay signs payment_id|subscription_id with the key secret.
    const expected = await hmacHex(env("RAZORPAY_KEY_SECRET"), `${paymentId}|${subId}`);
    if (!sameText(expected, String(signature))) return json({ error: "Signature mismatch." }, 400);

    const sub = await razorpay(`/subscriptions/${subId}`);
    await db
      .from("profiles")
      .update({ subscription_status: sub.status, current_period_end: toIso(sub.current_end ?? sub.start_at) })
      .eq("id", user.id);

    return json({ status: sub.status });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not verify the payment." }, 500);
  }
});
