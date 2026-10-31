import { supabase } from "./supabase";
import { PRICE } from "./pricing";

// The monthly price (PRICE) through Razorpay Subscriptions. The server creates the subscription
// (keys never reach the browser), Razorpay's own Checkout takes the payment, and
// the server verifies the signature before marking the account a member.

type Outcome = "paid" | "dismissed" | "unavailable" | "error";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Razorpay Checkout did not load"));
    document.head.appendChild(s);
  });
}

export async function subscribe(email?: string): Promise<Outcome> {
  if (!supabase) return "unavailable";
  const { data, error } = await supabase.functions.invoke("razorpay-subscription", { body: {} });
  if (error || !data?.subscription_id || !data?.key_id) return "error";
  try {
    await loadCheckout();
  } catch {
    return "error";
  }
  return new Promise<Outcome>((resolve) => {
    const checkout = new window.Razorpay!({
      key: data.key_id,
      subscription_id: data.subscription_id,
      name: "Inside one mind",
      description: data.starts_later ? `${PRICE}, first charge when your free week ends` : PRICE,
      prefill: email ? { email } : undefined,
      theme: { color: "#f9a3c0" },
      handler: async (resp: RazorpayResponse) => {
        const verified = await supabase!.functions.invoke("razorpay-verify", { body: resp });
        resolve(verified.error ? "error" : "paid");
      },
      modal: { ondismiss: () => resolve("dismissed") },
    });
    checkout.open();
  });
}
