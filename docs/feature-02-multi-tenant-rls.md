# Feature 2: Multi-Tenant Data Isolation (Row-Level Security)

---

## 1. What problem does this feature actually solve?

Imagine TeamFlow has two companies using it: Acme Corp and Beta Ltd. Acme's
employees can see their own projects and tasks. Beta's employees can see theirs.
Neither should ever see the other's data.

The obvious way to enforce this is to add a filter to every single database
query in your code — "only fetch rows belonging to this company." That works,
but it has a catastrophic flaw: **you only need to forget one filter, anywhere
in the codebase, for a data leak to happen.** One missing WHERE clause. One
new developer who didn't know the rule. One rushed bug fix at 2am. The leak
is silent — no error, no warning. One company quietly sees another's data.

This feature solves that by moving the isolation rule down one level — **into
the database itself.** Instead of trusting every line of application code to
get it right, we tell the database: "No matter what query arrives, never show
rows from Company A to anyone whose session is set to Company B." The database
enforces this automatically, on every single query, with no way for the
application to accidentally bypass it.

That mechanism is called **Row-Level Security (RLS)**.

---

## 2. Step-by-step story of what happens when it runs

Picture Priya from Acme Corp clicking "View Projects" in her browser.

**Step 1 — The request arrives with her identity badge**

Her browser sends the request with her login token (JWT) in the header. This
token contains two key pieces of information: her user ID, and her company's ID.

**Step 2 — The app checks she actually belongs to that company**

Before anything else, a piece of code called `verifyOrgMembership` runs. It
looks directly at the database: "Does a real record exist saying Priya is
a member of Acme Corp?" If someone has tampered with her token to claim a
different company, this check catches it. She gets a "403 Forbidden" and the
request stops here.

**Step 3 — The app whispers the company ID to the database**

If the membership check passes, another piece of code called `setOrgContext`
runs. It opens a database session and quietly says: "For this conversation,
the current company is Acme Corp." It does this by setting a special variable
inside the database session — like putting on a name badge before walking into
a room.

Crucially, this variable is **temporary** — it only lasts for the duration of
this one request. When the request ends, it vanishes. The next request on the
same database connection starts clean, with no company set. This prevents a
situation where Connection 1 (Acme) finishes, and Connection 2 (Beta) reuses
that same connection but accidentally inherits Acme's badge.

**Step 4 — The query runs, and the database enforces the rule itself**

Now Priya's actual query runs: "Give me all projects." The database has a rule
(called a Policy) on the projects table that says: "Only return rows where the
company ID matches the badge currently worn in this session."

So even if the query said "give me ALL projects with no filter at all," the
database would silently trim the results to only Acme's projects. No error.
No warning. Just the right data.

**Step 5 — Cleanup**

When the response is sent back to Priya's browser, the database connection is
cleaned up. The company badge is removed. The connection goes back to the pool,
ready for the next request — whoever that might be.

---

## 3. A real-world analogy

Think of a large office building where multiple companies rent different floors.
The building has a security system.

The **application-level filter** approach is like telling every single employee:
"When you press a floor button in the elevator, only press your own company's
floor." That mostly works — but one confused new hire, one social engineering
attempt, and someone ends up on the wrong floor.

**Row-Level Security** is like the elevator itself having a built-in rule: it
reads your ID badge, and physically won't allow the doors to open on any floor
that isn't your company's floor. It doesn't matter what floor button you press,
or whether you even know the rules. The elevator enforces it for you,
every time, with no exceptions.

The "whisper to the database" step (setting the company ID variable) is like
swiping your badge at the elevator entrance. You prove who you are once, and
the elevator handles everything from there.

---

## 4. The ONE thing that would impress an interviewer

**The non-superuser role requirement.**

Most developers who learn about RLS miss this completely. Postgres has a silent
rule: **database superusers bypass Row-Level Security entirely.** If your Node.js
app connects to the database using the default `postgres` admin account (which
most tutorials show), every single RLS policy is completely ignored. Your data
is fully exposed with no error and no warning.

The fix is to create a separate, limited database account called `app_user` that
has just enough permission to read and write data — but is not a superuser. The
app server connects using this limited account. Now RLS policies apply.

The phrase for an interview: "I specifically set up a non-superuser database role
for the application connection, because Postgres silently bypasses RLS for
superusers. Most tutorials miss this, which means their RLS is a no-op. I also
wrote automated tests that verify the pool is connected as a non-superuser, and
that cross-tenant queries return zero rows."

---

## 5. Likely interviewer follow-up, and how to answer it

**Question:** "RLS blocks data at the database level — but you also have
`verifyOrgMembership` at the application level. Why do you need both? Isn't
RLS alone sufficient?"

**Answer:** They solve different problems and protect against different attack
vectors.

RLS protects against *accidental* application bugs — a missing WHERE clause,
a rushed query, a future developer who doesn't know the rules. It's the last
line of defense.

But RLS on the `projects` table reads a session variable (`app.current_org_id`)
that the app sets. If someone sent a request with a tampered token claiming to
belong to Org B, the app would set Org B's ID as the session variable — and
RLS would happily show them Org B's data. RLS doesn't know the user doesn't
belong there; it just enforces whatever ID is in the session variable.

`verifyOrgMembership` prevents this by checking the actual `org_members` table
in the database *before* the session variable is set. It verifies: "Does this
user actually have a row saying they belong to this org?" If not, the request
is rejected before the session variable is ever set, and RLS never runs.

The two layers together give you defense in depth: the application layer
catches the intentional attacks; the database layer catches the accidental bugs.

---

## Quiz — Answer one at a time

---

### Question 1 of 3

The app connects to Postgres using the `postgres` superuser account by
mistake. RLS policies are set up correctly on the projects table. Priya
from Acme Corp sends a request. What data does she get back, and why?

*(Type your answer. I'll confirm before moving to Question 2.)*
