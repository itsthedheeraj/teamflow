# Feature 6: Usage Metering & Rate Limiting (Redis)

---

## 1. What problem does this feature actually solve?

TeamFlow has two subscription tiers: Free and Pro. The Free tier has real
limits — 3 team members and 20 tasks. Without enforcement, those limits are
just text on a pricing page. Any user could ignore them completely.

But enforcing limits naively has a hidden cost. The obvious approach is to
run a `COUNT(*)` query against the database every time someone tries to add
a member or create a task: "How many tasks does this org have right now?
Is it under 20? Okay, proceed." That works, but at any meaningful scale it
means a COUNT query hitting a large tasks table on every single creation
attempt — slow, and wasteful.

This feature solves enforcement with a smarter design: Redis counters. Redis
is an in-memory data store that can increment or read a number in microseconds,
without touching the database. One counter per org tracks member count; another
tracks task count. On every add/remove, the counter updates. On every create
attempt, the counter is checked. Fast, cheap, and — critically — designed to
self-correct if it ever gets out of sync.

---

## 2. Step-by-step story of what happens when it runs

### Scenario A: A Free org tries to add a 4th team member

Acme Corp is on the Free plan with 3 members (the limit). The Owner tries
to invite a 4th person.

1. The invite request arrives and passes auth checks.

2. Before generating the invite token, the server asks Redis: "How many
   members does Acme Corp have?" Redis returns the number 3 in a fraction
   of a millisecond — no database query needed.

3. The server compares: 3 is at (not below) the limit of 3. The limit is
   exceeded.

4. The server returns a 403 error: "Your free plan allows up to 3 team
   members. Upgrade to Pro to add more." The invite is never created.

5. The UI shows this message with an "Upgrade to Pro" link.

### Scenario B: A member is successfully added, then later removed

1. Dev accepts an invite and joins Acme Corp. After the database insert
   confirms a row was actually added (not a no-op conflict), Redis is told:
   `INCR usage:acme-corp-id:members`. The counter moves from 2 to 3.

2. Three months later, Dev leaves. The owner clicks "Remove." The database
   row is deleted, then Redis is told: `DECR usage:acme-corp-id:members`.
   The counter moves from 3 to 2.

3. Now the limit check shows 2/3 — the slot is genuinely freed. The owner
   can invite someone new without hitting the limit.

### Scenario C: Redis restarts overnight

The Redis server restarts. All counters are gone. In the morning, the first
person tries to create a task.

1. The server asks Redis: "How many tasks does Acme Corp have?"

2. Redis says the key doesn't exist (it was wiped).

3. The server falls back to Postgres: runs a real `COUNT(*)` query and gets
   the true count — say, 17.

4. It writes 17 back into Redis so future checks are fast again.

5. The task creation proceeds normally. The user saw no error. The counter
   is now accurate again.

### Scenario D: A project with 5 tasks is deleted

When someone deletes a project, Postgres automatically deletes all its tasks
(this is called a cascade delete — one SQL command removes the project and
all its children). But those individual task deletions don't pass through
the task deletion code — they happen entirely inside Postgres.

To keep the counter accurate, the server counts how many tasks the project
had *before* deleting it, then after the cascade delete tells Redis: "Resync
your task counter by re-counting from Postgres." The counter corrects itself
to reflect the true new total.

---

## 3. A real-world analogy

Think of a nightclub with a strict capacity limit.

The **Redis counter** is the bouncer's clicker — a little handheld counter
that clicks up every time someone enters and clicks down every time someone
leaves. Checking the current count takes zero effort: just glance at the
number. No need to walk through the whole club counting heads every time.

The **Postgres fallback** is what happens if the bouncer drops the clicker
and it resets. They walk through the club once, count everyone physically
(slower, but accurate), and start clicking again from that correct number.

The **limit check** is the bouncer seeing the counter hit 200 (the fire
code limit) and stopping the next person at the door, no matter who they are
or what they say.

The **decrement on removal** is the click-down when someone leaves —
correctly freeing up space for the next person. Without the decrement, the
counter would only ever go up. The club would eventually block *everyone*
because the counter claimed it was at capacity, even after half the people
went home.

---

## 4. The ONE thing that would impress an interviewer

**The counter can only ever drift one direction without the decrement — and
this specific bug is how most usage metering systems break in production.**

A common beginner implementation only increments counters: on create, add
one; never subtract. Over time, the counter grows beyond the real resource
count because deletes are never reflected. A Free org deletes 10 tasks but
the counter still shows 20 — they're permanently locked out of creating
new tasks even though they're under the limit.

The fix requires pairing every "add" operation with a corresponding "remove"
operation, and being precise about *when* each fires:

- Increment only after the database write succeeds (never before — if the
  DB write fails and you already incremented, the counter is wrong).
- Decrement only after the database delete succeeds.
- For cascade deletes (deleting a project removes all its tasks), you
  can't decrement per-task because those deletions bypass the task deletion
  code entirely — so instead, resync the whole counter from Postgres after
  the cascade.

The phrase for an interview: "The hardest part of usage metering isn't the
increment — it's making sure every code path that removes a resource also
decrements the counter, including database cascade deletes that bypass
application code."

---

## 5. Likely interviewer follow-up, and how to answer it

**Question:** "Between the limit check and the actual database insert, another
concurrent request could sneak through. Couldn't two requests both read 19,
both think they're under the limit, and both insert — leaving you at 21 tasks
on a Free plan?"

**Answer:** Yes, this is a real race condition, and the current design has a
small window for it. This is called a Time-of-Check to Time-of-Use (TOCTOU)
race. Here's how to handle it depending on scale:

**For a portfolio / early-stage app:** the window is tiny (milliseconds) and
the consequence is minor (one or two tasks over the limit for a brief moment).
You can detect and correct it on the next check cycle.

**Tighter solution — atomic check-and-increment in Redis:** Instead of
`GET` (check) then separately `INCR` (increment), you can use a Lua script
executed atomically in Redis:

```
-- atomic: if count < limit, increment and return new value
-- if count >= limit, return -1 (blocked)
```

Because Redis is single-threaded, a Lua script runs without interruption —
no other command can sneak in between the check and the increment. This
eliminates the race entirely.

**Even tighter — Postgres advisory locks or serializable isolation:** For
billing-grade accuracy (not just metering), you'd use a Postgres transaction
with `SELECT ... FOR UPDATE` on the org row, increment an in-DB counter, and
commit. More overhead, but fully ACID-safe.

For TeamFlow's use case, the Redis Lua approach is the right balance — fast,
atomic, and correct without database overhead.

---

## Quiz — Answer one at a time

---

### Question 1 of 3

An org on the Free plan has 20 tasks. They delete a project that contained
5 of those tasks. Redis still shows a counter of 20. They immediately try to
create a new task. What happens, and why is that the right or wrong behavior?
Walk through the exact sequence of events.

*(Type your answer. I'll confirm before moving to Question 2.)*
