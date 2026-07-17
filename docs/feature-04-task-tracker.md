# Feature 4: Task Tracker

---

## 1. What problem does this feature actually solve?

The first three features built the invisible plumbing — who you are, which
company you belong to, whether your data is protected, what you're allowed to
do. But none of that matters without something useful to actually *do* inside
the app.

This feature is the product layer — the thing users actually log in for every
day. It gives every team a shared workspace where they can organize work into
**Projects** (big chunks of work, like "Launch website" or "Q3 marketing
campaign") and **Tasks** inside each project (specific things to do, like
"Write homepage copy" or "Set up analytics").

The problem it solves: without this, TeamFlow is just an authentication system
with no purpose. With it, the app becomes something a team actually uses,
which makes all the infrastructure underneath it meaningful and demonstrable.

---

## 2. Step-by-step story of what happens when it runs

### Creating a project

Priya, the Owner of Acme Corp, clicks "New project" and types "Website
Redesign." Here's what happens:

1. Her request hits the server carrying her login token.

2. The server runs the full auth chain: verify her token, confirm she's a
   member of Acme Corp, then open a database transaction and stamp it with
   Acme Corp's ID.

3. A new row is inserted into the `projects` table with Acme Corp's ID
   attached. Because of Row-Level Security (from Feature 2), even if the
   insert somehow forgot to include the company ID, RLS would still scope
   every future read to only show Acme's projects.

4. The project appears instantly in the project list on the left.

### Creating a task

Priya opens "Website Redesign" and clicks "Add task." She types "Write
homepage copy" and assigns it to her teammate Dev.

1. Same auth chain runs.

2. A new row is inserted into the `tasks` table with the project ID, Acme
   Corp's ID, and Dev's user ID in the "assigned to" field.

3. The task appears in the "To Do" column of the task board.

### Moving a task

Dev logs in, opens the project, sees the task assigned to him. He selects
"In Progress" from the status dropdown directly on the task card.

1. A PATCH request goes to the server with just the new status value.

2. The server updates only the `status` column and the `updated_at` timestamp.
   Everything else stays the same.

3. The card moves to the "In Progress" column on the board.

Later, when he finishes, he changes it to "Done." The card moves to the
final column. The whole board shows a live picture of where the team's work
stands.

---

## 3. A real-world analogy

Think of a physical office with a whiteboard divided into three sections:
"To Do," "In Progress," and "Done." Each sticky note is a task. When someone
starts working on something, they physically move the sticky note from "To Do"
to "In Progress." When they finish, they move it to "Done."

The Projects are like having multiple whiteboards — one per project. You pick
which whiteboard you want to look at, and you see only that project's tasks.

The important thing: **everyone in the office sees the same whiteboard.**
There's one shared view. When Dev moves his sticky note, Priya sees it move
the next time she looks at the board. There's no private copy — the team's
work is always in sync because it all lives in the same database, scoped to
the same company.

---

## 4. The ONE thing that would impress an interviewer

**Every task query uses the transaction-scoped database connection — never a fresh one.**

This is subtle but important. The app uses a connection pool — a group of
pre-opened database connections that get reused across requests to save
time. When you set the company context on a connection (the `SET LOCAL`
from Feature 2), that context only lives for the current transaction on
that specific connection.

All the task service functions receive the database connection as a
parameter (`client`) rather than grabbing a fresh one from the pool
themselves. This means:

- The company context that was set by `setOrgContext` middleware is
  definitely active on this connection.
- RLS policies are definitely enforced.
- All task reads and writes happen inside the same transaction, so if
  anything fails mid-request, it all rolls back cleanly.

If the task service had grabbed a fresh connection from the pool, it would
have no company context — RLS would return zero rows, and the task would
appear to silently disappear. By passing the connection as a parameter,
the code makes the dependency explicit and impossible to accidentally bypass.

The phrase for an interview: "Services in this app receive a database client
as a parameter rather than importing the pool directly, which enforces that
all queries run inside the transaction where the org context was set —
preventing accidental RLS bypass."

---

## 5. Likely interviewer follow-up, and how to answer it

**Question:** "Your task board has three columns — To Do, In Progress, Done.
How would you scale this to support custom columns or a different workflow
per project?"

**Answer:** The current design uses a fixed `status` column with a check
constraint (`todo`, `in_progress`, `done`). To support custom columns, you'd
introduce a `columns` table scoped to each project, with a `position` integer
for ordering. Tasks would have a `column_id` foreign key instead of a fixed
status enum.

The constraint would move from the database check to the application layer:
"column_id must reference a column belonging to the same project as the task."
You'd enforce this with either a trigger or an application-layer check before
insert.

The status field could stay as a derived concept — a column could have a
`maps_to_status` field (todo/in_progress/done) for reporting and filtering
without breaking the simple status-based query the rest of the app uses for
billing and metering purposes. This separation keeps the product flexible
without rewriting the infrastructure.

---

## Quiz — Answer one at a time

---

### Question 1 of 3

Priya from Acme Corp and Rajan from Beta Ltd both have the same task ID
in their respective databases (because UUIDs are randomly generated and
could theoretically collide — but ignore that edge case). Rajan sends a
request to `GET /api/tasks/<that-id>`.

What does Rajan get back, and what exactly prevents him from seeing
Priya's task? Walk through at least two different layers that protect
the data.

*(Type your answer. I'll confirm before moving to Question 2.)*
