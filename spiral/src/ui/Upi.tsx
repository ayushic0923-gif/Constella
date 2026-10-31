import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatDate } from "../data/model";
import { upi } from "../services/pricing";
import { upiLink, type Claim } from "../services/upi";

// Pay by UPI: scan the code (or open the UPI app on a phone), pay, then enter the reference
// number from the confirmation. The owner approves it; the database does the rest.

const onPhone = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const tail = (utr: string) => utr.slice(-4);

export function UpiPanel({
  claims,
  onBack,
  onSubmit,
  onRefresh,
}: {
  claims: Claim[];
  onBack: () => void;
  onSubmit: (utr: string) => Promise<string | null>;
  onRefresh: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const latest = claims[0];
  const [showForm, setShowForm] = useState(!latest || latest.status !== "pending");

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(upiLink(), { width: 480, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0e1f", light: "#ffffff" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (latest?.status === "pending") setShowForm(false);
  }, [latest?.status]);

  if (!upi) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upi?.id ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Some browsers refuse; the ID is on screen to select by hand.
    }
  };

  const submit = async () => {
    if (!/^\d{12}$/.test(utr)) {
      setError("The reference is 12 digits. You’ll find it in your UPI app, on the payment you just made.");
      return;
    }
    setSending(true);
    setError(null);
    const err = await onSubmit(utr);
    setSending(false);
    if (err) setError(err);
    else {
      setUtr("");
      setShowForm(false);
    }
  };

  return (
    <div className="upi">
      <h2 id="account-title" className="panel__title">
        Keep writing
      </h2>
      <p className="panel__line">
        ₹{upi.amount} for 30 days. Pay from any UPI app, then tell us the reference number. Your free week and everything you saved stay as they are.
      </p>

      <div className="upi__grid">
        <div className="upi__scan">
          <div className="upi__qr">
            {qr ? <img src={qr} width={208} height={208} alt={`UPI QR code to pay ₹${upi.amount} to ${upi.name}`} /> : <span className="upi__qr-wait">Making your code…</span>}
          </div>
          {onPhone ? (
            <a className="primary" href={upiLink()}>
              Open my UPI app
            </a>
          ) : (
            <p className="upi__hint">Scan with any UPI app</p>
          )}
        </div>

        <div className="upi__pay">
          <p className="upi__amount">₹{upi.amount}</p>
          <p className="upi__to">to {upi.name}</p>
          <p className="upi__id">
            <span>{upi.id}</span>
            <button type="button" className="inline-link" onClick={copy} aria-live="polite">
              {copied ? "Copied" : "Copy"}
            </button>
          </p>
          <ol className="upi__steps">
            <li>Pay ₹{upi.amount} using the code or the UPI ID.</li>
            <li>Find the 12-digit reference number in your app (it may say UPI reference, UTR or transaction ID).</li>
            <li>Enter it below. We check it against our account and add your 30 days, usually within a few hours.</li>
          </ol>
        </div>
      </div>

      {latest && (
        <div className={`upi__state upi__state--${latest.status}`} role="status">
          {latest.status === "pending" && (
            <>
              <strong>Waiting for confirmation</strong>
              <span>
                Reference ending {tail(latest.utr)}, sent {formatDate(latest.created_at)}. We’ll add your 30 days as soon as we see the payment.
              </span>
            </>
          )}
          {latest.status === "approved" && (
            <>
              <strong>Payment confirmed</strong>
              <span>Thank you. Your 30 days have been added.</span>
            </>
          )}
          {latest.status === "rejected" && (
            <>
              <strong>We couldn’t match that payment</strong>
              <span>{latest.note || `Reference ending ${tail(latest.utr)} didn’t match a payment. Please check the number and try again.`}</span>
            </>
          )}
          <span className="upi__state-actions">
            <button type="button" className="inline-link" onClick={onRefresh}>
              Check again
            </button>
            {latest.status === "pending" && !showForm && (
              <button type="button" className="inline-link" onClick={() => setShowForm(true)}>
                Enter a different reference
              </button>
            )}
          </span>
        </div>
      )}

      {showForm && latest?.status !== "approved" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field-label" htmlFor="upi-reference">
            UPI reference number
          </label>
          <input
            id="upi-reference"
            className="field"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="12 digits"
          />
          {error && <p className="panel__error">{error}</p>}
          <div className="panel__actions">
            <button type="button" className="textbtn" onClick={onBack}>
              Back
            </button>
            <button type="submit" className="primary" disabled={sending}>
              {sending ? "Sending…" : "I’ve paid"}
            </button>
          </div>
        </form>
      )}

      {(!showForm || latest?.status === "approved") && (
        <div className="panel__actions">
          <button type="button" className="primary" onClick={onBack}>
            {latest?.status === "approved" ? "Done" : "Back to my account"}
          </button>
        </div>
      )}
    </div>
  );
}
