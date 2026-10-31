import { supabase } from "./supabase";
import { upi } from "./pricing";

// Paying by UPI without a payment gateway. The person pays the UPI ID shown on screen, then
// types the 12-digit reference (UTR) from their payment confirmation. The owner checks it
// against their bank or UPI app and approves it in the Supabase dashboard, which adds
// 30 days to the account. The database enforces all of it (see the upi_payments migration).

export interface Claim {
  utr: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  amount_inr: number;
  created_at: string;
}

/** The link a UPI app opens (and the QR code encodes) with the payee and amount filled in. */
export function upiLink(): string {
  if (!upi) return "";
  return `upi://pay?pa=${upi.id}&pn=${encodeURIComponent(upi.name)}&am=${upi.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Inside One Mind")}`;
}

function plain(code: string | undefined, message: string): string {
  if (code === "23505") return "That reference has already been used. Check the number and try again.";
  if (code === "23514") return "The reference should be exactly 12 digits.";
  if (code === "42501") return "You already have payments waiting to be checked. Please wait for those first.";
  return message;
}

export async function submitClaim(utr: string): Promise<string | null> {
  if (!supabase || !upi) return "Payments aren’t set up yet.";
  const { error } = await supabase.from("payments").insert({ utr, amount_inr: upi.amount });
  return error ? plain(error.code, error.message) : null;
}

export async function loadClaims(): Promise<Claim[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("payments").select("utr, status, note, amount_inr, created_at").order("created_at", { ascending: false }).limit(5);
  return (data as Claim[] | null) ?? [];
}
