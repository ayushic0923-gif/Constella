import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null until the project's Supabase keys are set (see README). */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const accountsEnabled = !!supabase;

export interface Profile {
  id: string;
  trial_ends_at: string;
  subscription_status: string;
  current_period_end: string | null;
}

export type Access =
  | { state: "trial"; until: Date; daysLeft: number }
  | { state: "member"; until: Date | null }
  | { state: "ended"; since: Date };

/** Free for a week from sign-up, then while the $1 subscription is active. Mirrors has_access() in the database. */
export function accessOf(p: Profile, now = new Date()): Access {
  const trialEnd = new Date(p.trial_ends_at);
  const periodEnd = p.current_period_end ? new Date(p.current_period_end) : null;
  const paid = p.subscription_status === "active" || p.subscription_status === "authenticated";
  if (paid && (!periodEnd || periodEnd.getTime() > now.getTime() - 86400000)) {
    return { state: "member", until: periodEnd };
  }
  if (trialEnd > now) {
    return { state: "trial", until: trialEnd, daysLeft: Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) };
  }
  return { state: "ended", since: trialEnd };
}

export async function loadProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("id, trial_ends_at, subscription_status, current_period_end").eq("id", auth.user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function sendSignInLink(email: string): Promise<string | null> {
  if (!supabase) return "Accounts aren’t connected in this preview yet.";
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  return error ? error.message : null;
}
