// POST — create a $1-a-month Razorpay subscription for the signed-in person.
// If their free week is still running, the first charge waits until it ends.
import { admin, caller, cors, env, json, razorpay } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const user = await caller(req);
    if (!user) return json({ error: "Sign in first." }, 401);

    const db = admin();
    const { data: profile, error } = await db
      .from("profiles")
      .select("trial_ends_at, subscription_status")
      .eq("id", user.id)
      .single();
    if (error || !profile) return json({ error: "No profile for this account." }, 404);
    if (profile.subscription_status === "active" || profile.subscription_status === "authenticated") {
      return json({ error: "Already a member." }, 409);
    }

    const trialEnd = Math.floor(new Date(profile.trial_ends_at).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const startsLater = trialEnd > now + 600;

    const subscription = await razorpay("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: env("RAZORPAY_PLAN_ID"),
        total_count: 120, // ten years of months; cancellable any time
        quantity: 1,
        customer_notify: 1,
        ...(startsLater ? { start_at: trialEnd } : {}),
        notes: { user_id: user.id, email: user.email },
      }),
    });

    await db
      .from("profiles")
      .update({ razorpay_subscription_id: subscription.id, subscription_status: subscription.status })
      .eq("id", user.id);

    return json({ subscription_id: subscription.id, key_id: env("RAZORPAY_KEY_ID"), starts_later: startsLater });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not start the subscription." }, 500);
  }
});
