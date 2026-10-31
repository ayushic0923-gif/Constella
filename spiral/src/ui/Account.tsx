import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { accountsEnabled, signInWithPassword, signUpWithPassword, type Access } from "../services/supabase";
import { PRICE, RENEWAL, upi } from "../services/pricing";
import { loadClaims, submitClaim, type Claim } from "../services/upi";
import { formatDate } from "../data/model";
import { UpiPanel } from "./Upi";

function describe(access: Access | null): string {
  if (!access) return "Setting up your account…";
  if (access.state === "trial") return `Free week: ${access.daysLeft} ${access.daysLeft === 1 ? "day" : "days"} left (until ${formatDate(access.until)}).`;
  if (access.state === "member") return access.until ? `Member ${upi ? "until" : ". Renews on"} ${formatDate(access.until)}.`.replace(" .", ".") : "Member.";
  return "Your free week has ended. Pay to keep adding thoughts; everything you saved is still here.";
}

export function AccountDialog({
  open,
  email,
  access,
  onClose,
  onSubscribe,
  onSignOut,
  onRefresh,
}: {
  open: boolean;
  email: string | null;
  access: Access | null;
  onClose: () => void;
  onSubscribe: () => Promise<string | null>;
  onSignOut: () => void;
  /** Reload the account's access, for when a payment may have been approved. */
  onRefresh: () => void;
}) {
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [view, setView] = useState<"account" | "upi">("account");
  const [claims, setClaims] = useState<Claim[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => {
    onRefresh();
    if (upi) void loadClaims().then(setClaims);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setView("account");
    if (state !== "sent") setState("idle");
    if (email) refresh();
    requestAnimationFrame(() => input.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email]);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(address.trim())) {
      setError("That doesn’t look like an email address.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    setState("sending");
    setError(null);
    if (mode === "signin") {
      const err = await signInWithPassword(address.trim(), password);
      setState("idle");
      if (err) setError(err);
      else setPassword(""); // signed in: the dialog switches to "Your account" by itself
      return;
    }
    const { error: err, needsConfirm } = await signUpWithPassword(address.trim(), password);
    if (err) {
      setError(err);
      setState("idle");
    } else if (needsConfirm) setState("sent");
    else {
      setPassword("");
      setState("idle");
    }
  };

  const pay = async () => {
    setPaying(true);
    setError(await onSubscribe());
    setPaying(false);
  };

  const waiting = claims.find((c) => c.status === "pending");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className={`panel${email && view === "upi" ? " panel--wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
              }
            }}
          >
            {email && view === "upi" && upi ? (
              <UpiPanel
                claims={claims}
                onBack={() => {
                  setView("account");
                  refresh();
                }}
                onSubmit={async (utr) => {
                  const err = await submitClaim(utr);
                  if (!err) setClaims(await loadClaims());
                  return err;
                }}
                onRefresh={refresh}
              />
            ) : email ? (
              <>
                <h2 id="account-title" className="panel__title">
                  Your account
                </h2>
                <p className="panel__line">{email}</p>
                <p className="panel__status">{describe(access)}</p>
                {waiting && (
                  <p className="panel__line">
                    Your payment (reference ending {waiting.utr.slice(-4)}) is waiting to be confirmed. We’ll add your 30 days as soon as we see it.
                  </p>
                )}
                {access && access.state !== "member" && !waiting && (
                  <p className="panel__line">
                    {upi
                      ? `After the free week, ₹${upi.amount} buys 30 more days, paid by UPI. ${RENEWAL}`
                      : `${PRICE} after the free week, paid through Razorpay. ${access.state === "trial" ? "Subscribe now and the first charge waits until your free week ends." : ""}`}
                  </p>
                )}
                {error && <p className="panel__error">{error}</p>}
                <div className="panel__actions">
                  <button type="button" className="textbtn" onClick={onSignOut}>
                    Sign out
                  </button>
                  {upi ? (
                    access && (access.state !== "member" || access.until) && (
                      <button type="button" className={access.state === "member" ? "textbtn" : "primary"} onClick={() => setView("upi")}>
                        {waiting ? "See payment status" : access.state === "member" ? "Add 30 days" : `Pay ₹${upi.amount} with UPI`}
                      </button>
                    )
                  ) : (
                    access &&
                    access.state !== "member" && (
                      <button type="button" className="primary" onClick={pay} disabled={paying}>
                        {paying ? "Opening Razorpay…" : `Subscribe for ${PRICE}`}
                      </button>
                    )
                  )}
                </div>
              </>
            ) : state === "sent" ? (
              <>
                <h2 id="account-title" className="panel__title">
                  Check your inbox
                </h2>
                <p className="panel__line">We sent a link to {address} to confirm your email. Open it and you’re in.</p>
                <div className="panel__actions">
                  <button type="button" className="primary" onClick={onClose}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <h2 id="account-title" className="panel__title">
                  {mode === "create" ? "Keep your own mind" : "Welcome back"}
                </h2>
                <p className="panel__line">
                  {mode === "create"
                    ? `Save your thoughts for as long as you like and see how they connect. Free for 7 days, then ${PRICE}. ${RENEWAL}`
                    : "Sign in to see your own mind again."}
                </p>
                {!accountsEnabled && <p className="panel__error">Accounts aren’t connected in this preview yet.</p>}
                <label className="field-label" htmlFor="account-email">
                  Email
                </label>
                <input
                  id="account-email"
                  ref={input}
                  className="field"
                  type="email"
                  autoComplete="email"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="you@example.com"
                />
                <label className="field-label" htmlFor="account-password">
                  Password
                </label>
                <input
                  id="account-password"
                  className="field"
                  type="password"
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                {error && <p className="panel__error">{error}</p>}
                <div className="panel__actions">
                  <button
                    type="button"
                    className="textbtn"
                    onClick={() => {
                      setMode(mode === "create" ? "signin" : "create");
                      setError(null);
                    }}
                  >
                    {mode === "create" ? "I already have an account" : "Create an account"}
                  </button>
                  <button type="submit" className="primary" disabled={state === "sending" || !accountsEnabled}>
                    {state === "sending" ? "One moment…" : mode === "create" ? "Create my account" : "Sign in"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
