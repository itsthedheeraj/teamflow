# Feature 5: Stripe Subscription Billing

---

## 1. What problem does this feature actually solve?

TeamFlow needs to earn money. Companies use it for free up to a point, but
once they want more team members or more tasks, they need to pay for a Pro
plan. The problem is: how do you collect money safely, without handling credit
card details yourself (which would require serious security compliance), and
how do you know reliably that a payment actually succeeded?

There are two hidden traps here that most beginners fall into:

**Trap 1 — Handling card details yourself.** If you build your own payment
form and send card numbers to your server, you become responsible for storing
and protecting that data. This requires PCI compliance certification, which
is expensive and difficult. Stripe solves this by hosting the payment page
themselves — your app never sees the card number at all.

**Trap 2 — Trusting the browser redirect.** After a user pays, Stripe
redirects their browser back to your site. Many beginners treat this redirect
as "proof" that the payment went through and immediately upgrade the account.
But the redirect can be faked, it can arrive before the payment is fully
processed, or a user could close the tab right after paying and the redirect
never fires. If you rely on the redirect, you'll have users who paid but
didn't get Pro, and possibly users who faked the redirect to get Pro for free.

This feature solves both traps: Stripe hosts the payment page, and the server
only upgrades an account when Stripe sends a direct server-to-server
notification (called a webhook) confirming the payment.

---

## 2. Step-by-step story of what happens when it runs

### The upgrade flow

Picture Priya, the Owner of Acme Corp, hitting the task limit on the Free
plan. A message appears: "Upgrade to add more tasks." She clicks the
"Upgrade to Pro" button on the Billing page.

**Step 1 — Checkout session created**

Her browser sends a request to TeamFlow's server. The server calls Stripe's
API and says: "Create a checkout session for Acme Corp's Pro subscription."
Stripe creates a temporary, secure payment page and returns a URL to it.
TeamFlow sends that URL back to Priya's browser, which redirects her to
Stripe's site.

**Step 2 — Payment on Stripe's page**

Priya is now on Stripe's hosted page — not TeamFlow's site. She types in her
credit card details. Stripe handles everything: validation, processing, fraud
checks. TeamFlow's server never sees the card number.

**Step 3 — Stripe sends a webhook to TeamFlow**

About a second after the payment goes through, Stripe calls TeamFlow's server
directly — not through the browser — with a notification: "checkout
completed." This is a server-to-server call, completely separate from the
browser.

TeamFlow's server receives this notification, verifies it actually came from
Stripe (using a secret key to check a digital signature on the message), and
then upgrades Acme Corp's subscription tier in the database to "pro."

**Step 4 — Browser redirect (cosmetic only)**

Meanwhile, Stripe also redirects Priya's browser back to TeamFlow's Billing
page with a "?success=true" parameter. The page shows a congratulations
banner. But this banner is purely cosmetic — the actual upgrade happened in
Step 3, via the webhook. If Priya had closed her browser after Step 2, the
upgrade still would have happened because Step 3 is independent of her
browser.

### What happens if Stripe sends the same notification twice?

Stripe's system guarantees delivery of webhooks "at least once" — meaning
the same notification can arrive two or three times if there are network
hiccups. If TeamFlow processed every arrival, Acme Corp might get upgraded,
then downgraded, then upgraded again — billing chaos.

The fix: when a webhook arrives, TeamFlow immediately tries to record its
unique event ID in the database. If the ID is already there (because this
event was already processed), the database rejects the insert, and TeamFlow
sends Stripe a "received" response without touching the subscription. The
account is upgraded exactly once, no matter how many times Stripe delivers
the notification.

---

## 3. A real-world analogy

Think of ordering a product online and tracking the delivery.

**The Stripe checkout page** is like the store's payment terminal — you hand
your card to the cashier (Stripe), not to the delivery person (TeamFlow).
TeamFlow never touches your card.

**The webhook** is like a courier company's internal system notifying the
warehouse: "Order paid and confirmed — ship it." This notification goes
directly from the payment processor to the warehouse, regardless of whether
the customer is still on the website. The warehouse acts on this notification
alone, not on what the customer claims on the website.

**The browser redirect** is like the receipt email you get after checkout.
It's a nice confirmation for you, but the warehouse already got its own
notification and started packing. Even if your email went to spam, your
order still gets shipped.

**The idempotency check** is like the warehouse's system flagging duplicate
order confirmations: "We already processed order #EVT-12345 — ignore this
copy."

---

## 4. The ONE thing that would impress an interviewer

**The webhook route is mounted before `express.json()` — and this is the
only reason signature verification works.**

Here's the subtle technical fact: Stripe verifies that a webhook is genuine
by generating a digital signature from the raw bytes of the request body.
Your server recreates that signature from its copy of the raw bytes and
compares them. If they match, the webhook is real.

The problem: `express.json()` — the middleware that reads the request body
and converts it from raw bytes to a JavaScript object — consumes and
discards those raw bytes in the process. If `express.json()` runs first,
the raw bytes are gone. Signature verification fails. Every legitimate
webhook gets rejected with "No signatures found."

The fix is one line of code ordering in `app.js`: mount the webhook route
before `express.json()`. The webhook route uses its own `express.raw()`
middleware to read the body as raw bytes and hold onto them. Every other
route uses the parsed JSON body as normal.

The phrase for an interview: "I mounted the Stripe webhook endpoint before
the `express.json()` middleware because signature verification requires
the raw request bytes — once the body parser runs, those bytes are gone
and every webhook would fail verification."

---

## 5. Likely interviewer follow-up, and how to answer it

**Question:** "You're storing processed Stripe event IDs in Postgres to
prevent duplicate processing. What happens if two webhook deliveries arrive
at exactly the same time and both hit the INSERT before either has committed?
Could you still process the event twice?"

**Answer:** This is a race condition, and Postgres's UNIQUE constraint
handles it correctly.

Both requests try to INSERT the same event ID. Only one INSERT can succeed —
the UNIQUE constraint is enforced at the database level with a lock. The
second INSERT will fail with a unique violation error. The winner processes
the event; the loser sees the error code `23505` (Postgres's code for unique
violation), skips processing, and returns 200 to Stripe.

The key is that the UNIQUE constraint is enforced by the database engine
itself, not by the application. You can't have two successful INSERTs of the
same value — Postgres prevents it atomically, regardless of timing. This is
exactly the kind of guarantee a relational database provides that an
application-level check (like "SELECT first, then INSERT if not found")
cannot, because that pattern has a gap between the SELECT and the INSERT
where a race can slip through.

---

## Quiz — Answer one at a time

---

### Question 1 of 3

Priya pays for Pro on Stripe's checkout page, then immediately closes her
browser before it redirects back to TeamFlow. Does her organization get
upgraded to Pro? Walk through exactly what happens and why.

*(Type your answer. I'll confirm before moving to Question 2.)*
