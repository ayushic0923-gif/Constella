// How the site asks to be paid. When a UPI ID is set (VITE_UPI_ID, VITE_UPI_NAME and
// VITE_UPI_AMOUNT in rupees), people pay by UPI and the owner approves each payment.
// Otherwise the Razorpay subscription is used. None of these values is a secret: a UPI ID
// is meant to be shared, and it is shown on the payment screen.

const id = (import.meta.env.VITE_UPI_ID as string | undefined)?.trim() ?? "";
const name = (import.meta.env.VITE_UPI_NAME as string | undefined)?.trim() ?? "";
const amount = Math.round(Number(import.meta.env.VITE_UPI_AMOUNT));

// name@bank: letters, digits, dots, dashes and underscores, then the bank's handle.
const VALID_ID = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;

export const upi = VALID_ID.test(id) && name && amount > 0 && amount <= 100000 ? { id, name, amount } : null;

// The Razorpay plan's price as people should read it, e.g. "₹99 a month". Set it to match the
// plan created in Razorpay; it defaults to "$1 a month".
const planLabel = (import.meta.env.VITE_PRICE_LABEL as string | undefined)?.trim() || "$1 a month";

/** What people see as the price. */
export const PRICE = upi ? `₹${upi.amount} a month` : planLabel;

/** What happens after the free week, in one line. */
export const RENEWAL = upi ? "Pay month to month; nothing renews by itself." : "Cancel any time.";
