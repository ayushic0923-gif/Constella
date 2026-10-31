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

/** What Supabase says, in words a person can act on. */
function plain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return "That email already has an account. Choose “I already have an account” to sign in.";
  if (m.includes("invalid login")) return "That email and password don’t match.";
  if (m.includes("not confirmed")) return "Please confirm your email first, using the link we sent you.";
  if (m.includes("rate limit")) return "Too many sign-up attempts right now. Please try again in a little while.";
  if (m.includes("password")) return "Choose a password of at least 8 characters.";
  return message;
}

/**
 * Create an account with an email and a password. With "Confirm email" off in Supabase there is
 * nothing to send, so the person is signed in at once; with it on, `needsConfirm` is true and
 * they must open the link that was emailed first.
 */
export async function signUpWithPassword(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  if (!supabase) return { error: "Accounts aren’t connected in this preview yet.", needsConfirm: false };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
  if (error) return { error: plain(error.message), needsConfirm: false };
  return { error: null, needsConfirm: !data.session };
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Accounts aren’t connected in this preview yet.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? plain(error.message) : null;
}

export async function sendSignInLink(email: string): Promise<string | null> {
  if (!supabase) return "Accounts aren’t connected in this preview yet.";
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  return error ? error.message : null;
}
