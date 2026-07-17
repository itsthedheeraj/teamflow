# Feature 1: Auth & Organizations

---

## 1. What problem does this feature actually solve?

Imagine you want to build an app like Slack or Trello — where a whole *company* signs up together, not just one person at a time. The problem is: how do you connect a user to their company the moment they sign up? How do you make sure they stay "logged in" without asking for their password on every page? And how do you prove to the app who they are and which company they belong to with every single click?

Without this feature, the app has no idea who anyone is. Every page would be wide open. Anyone could see anyone else's data. There'd be no concept of "your team" vs "someone else's team."

This feature solves three things in one go:
- It creates a **user account** and a **company workspace** at the exact same moment (one form, one button click).
- It keeps the user "logged in" using a small digital pass called a **JWT** (explained below), so they don't need to log in again on every page.
- It stamps every request the user makes with **who they are** and **which company they belong to**, so the rest of the app always knows the context.

---

## 2. Step-by-step story of what happens when it runs

### Signing up

Picture someone named Priya who works at "Acme Corp." She goes to the signup page and fills in three things: her email, a password, and her company name.

She clicks "Create workspace." Here's what happens behind the scenes, in order:

1. Her password gets scrambled into an unreadable string (called a hash) before it ever touches the database. Even if someone broke into the database, they'd see gibberish — not her real password.

2. A new row gets added to the **users** table with her email and that scrambled password.

3. A new row gets added to the **organizations** table for "Acme Corp."

4. A third row gets added to a join table called **org_members** that says: "Priya is connected to Acme Corp, and her role is Owner."

5. All three of those database writes happen together in a single package called a **transaction**. If any one of them fails (say, the org name is taken), *all three* get cancelled — no half-created accounts left behind.

6. The server creates a JWT (a small, signed token — think of it like a stamped ticket) containing Priya's user ID, Acme Corp's ID, and her role. This token is sent back to her browser.

7. Her browser saves that token in local storage. From this point on, every request she makes will include this token in the header — like flashing her ID badge at the door.

### Logging in

If Priya closes the tab and comes back later, she goes to the login page, enters her email and password. The server looks up her account, checks if the password she typed matches the scrambled version stored in the database, and if yes — issues her a fresh token. She's back in.

### Switching organizations

A user can belong to multiple companies (say Priya is a contractor who works for both Acme Corp and Beta Ltd). The org switcher dropdown in the top navigation lets her pick which company's workspace she wants to be in. Clicking it sends her current org's ID to the server, which issues a new token with the new company's ID baked in. The whole app then re-loads scoped to that company.

---

## 3. A real-world analogy

Think of a hotel check-in desk.

When you arrive, you give your name and ID. The hotel creates a record for you and assigns you to a room (your organization). They hand you a **key card** — that's the JWT. The key card has no name written on it, but it's been encoded with your room number and an expiry date.

Every time you want to open your room door, you tap the key card. The door reader doesn't call the front desk to check who you are — it just reads the card itself. That's how JWT works: the server doesn't need to look you up in a database every time. The token carries all the information it needs, and the server just verifies the signature to make sure the card isn't fake.

If you check out of one hotel and check into another (switching orgs), you hand back your old card and get a new one with the new room number.

---

## 4. The ONE thing that would impress an interviewer

The signup creates a **user AND an organization in a single database transaction.**

Most beginners would write the signup as three separate database calls: insert user, insert org, insert membership. If the server crashes after step 2, you'd have a user with no org, and no way to clean it up. The app would be in a broken state.

Wrapping all three writes in a transaction means they either *all succeed* or *all fail together*. The database guarantees this. If anything goes wrong mid-way, Postgres automatically rolls everything back as if none of it happened.

The phrase to use in an interview: "I used a database transaction to guarantee atomicity on signup — either all three writes succeed together or none of them do. This prevents orphaned records."

---

## 5. Likely interviewer follow-up, and how to answer it

**Question:** "You're storing a JWT in localStorage. What's the security concern with that, and how would you address it?"

**Answer:** LocalStorage is accessible to JavaScript, which means if an attacker can inject malicious JavaScript into your page (called an XSS attack), they can steal the token. A more secure approach is to store the token in an **HttpOnly cookie** — a cookie that JavaScript cannot read at all, only the browser sends it automatically with each request. The tradeoff is that HttpOnly cookies require a bit more server-side setup (CSRF protection) and don't work as naturally with some API setups. For a portfolio project, localStorage is an acceptable starting point as long as you can articulate the tradeoff. In production, you'd switch to HttpOnly cookies.

---

## Quiz — Answer one at a time

I'll ask you three questions. Answer each one before I show you the next. Take your time — there's no timer.

---

### Question 1 of 3

When Priya signs up and the server crashes halfway through — after creating her user row but before creating the organization — what happens to her user row in the database, and why?

*(Type your answer below. I'll tell you if you're right before moving to Question 2.)*
