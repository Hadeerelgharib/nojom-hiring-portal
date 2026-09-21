# Nojom Hiring Request Portal — Setup & Deployment Guide

This is a real, production-ready web application. Anyone with the public
link can submit a Hiring Request without an account. HR Manager, Final
Approver, and HR Admin actions require signing in with a real account you
create. Submitted requests are stored securely in a Supabase database, and
the existing approval workflow (Requesting Manager → HR Manager → Final
Management) is enforced on the server, not just in the browser.

You do not need to be a developer to complete this guide, but you will
copy/paste a few values. Budget about 20–30 minutes for the one-time setup.

There are three parts:

1. Create the database (Supabase) — free, ~10 minutes
2. Create your three approver logins — ~5 minutes
3. Put the website online (Netlify Drop) — free, ~5 minutes

---

## Part 1 — Create the database (Supabase)

Supabase is a free hosting service for the database that stores every
Hiring Request. You do not need to know any coding.

1. Go to **https://supabase.com** and click **Start your project**. Sign up
   with your email or a Google account (free tier — no credit card
   required).
2. Click **New project**.
   - **Name**: `nojom-hiring-portal` (or anything you like)
   - **Database Password**: click "Generate a password" and **save it
     somewhere safe** (a password manager or a note) — you won't need it
     for this guide, but keep it in case you need it later.
   - **Region**: pick the region closest to Egypt (e.g. an EU or Middle
     East region) for the fastest experience.
   - Click **Create new project** and wait 1–2 minutes while it sets up.
3. Once the project is ready, open the **SQL Editor** from the left
   sidebar (the icon that looks like `>_`).
4. Click **New query**.
5. Open the file **`supabase/schema.sql`** from this package (open it in
   any text editor, or Notepad/TextEdit), select all its contents
   (Ctrl/Cmd+A), copy it, and paste the whole thing into the Supabase SQL
   Editor.
6. Click **Run** (or press Ctrl/Cmd+Enter). You should see
   "Success. No rows returned." This has created the requests table, the
   security rules, and everything the site needs. It's safe to run more
   than once if you ever need to.
7. Now collect the two values the website needs to connect:
   - In the left sidebar, click the **gear icon (Project Settings)**, then
     **Data API**.
   - Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
   - Scroll to **Project API keys** and copy the key labeled
     **`anon` `public`** (a long string starting with `eyJ...`). This key
     is safe to publish on a public website — it has no access to
     anything beyond what the security rules in `schema.sql` explicitly
     allow.
   - Keep this browser tab open — you'll paste both values in Part 3.

---

## Part 2 — Create your three approver logins

Every hiring request has three approval steps. The first (Requesting
Manager) is signed directly on the form by whoever submits the request —
no login needed. The other two need a real account:

- **HR Manager** — reviews and approves/rejects first
- **Final Approver** — gives final management sign-off
- **HR Admin** — manages recruitment status and can edit the "HR Use Only"
  section (and can also see everything the other two see)

You can create as many accounts as you like (e.g. more than one HR
Manager), but you need at least one of each role for the workflow to
function.

For each person:

1. In Supabase, open **Authentication** in the left sidebar, then the
   **Users** tab.
2. Click **Add user** → **Create new user**.
   - Enter their **email address** and a **password** (they can change it
     later — see the note at the end of this section).
   - Leave "Auto Confirm User" turned **on** so they can sign in right
     away.
   - Click **Create user**.
3. Click on the row for the user you just created and **copy their User
   UID** (a long id like `a1b2c3d4-...`).
4. Go back to the **SQL Editor** → **New query**, and run this (replacing
   the placeholders), once per person:

   ```sql
   insert into public.profiles (id, full_name, role) values
     ('paste-the-user-uid-here', 'Full Name', 'hr_manager');
   ```

   Set `role` to exactly one of: `hr_manager`, `final_approver`, or
   `hr_admin`.

   Example, for three people:

   ```sql
   insert into public.profiles (id, full_name, role) values
     ('11111111-1111-1111-1111-111111111111', 'Mona Youssef', 'hr_manager'),
     ('22222222-2222-2222-2222-222222222222', 'Karim Adel', 'final_approver'),
     ('33333333-3333-3333-3333-333333333333', 'Salma Hassan', 'hr_admin');
   ```

That's it — those people can now sign in on the live site using the email
and password you set for them (via the "Sign in" button, top right).

**Letting someone reset or choose their own password:** the simplest
option is to set a temporary password when you create their account and
tell them what it is, then have them sign in and you can update their
password any time from **Authentication → Users → (their row) → Reset
password**. If you want a self-service "Forgot password" email flow,
Supabase supports it (Authentication → Providers → Email → enable
"Confirm email" and configure an email sender), but that's an optional
later step, not required to launch.

**Adding or removing an approver later:** repeat step 1–4 above to add
someone new. To remove access, delete their row from
**Authentication → Users**, or run
`delete from public.profiles where id = 'their-user-uid';` to revoke their
role while keeping their login.

---

## Part 3 — Connect the website to your database

1. Open **`config.js`** from this package in any text editor.
2. Replace the two placeholder values with what you copied in Part 1,
   step 7:

   ```js
   const SUPABASE_CONFIG = {
     url: "https://abcdefgh.supabase.co",       // your Project URL
     anonKey: "eyJhbGciOi..."                     // your anon public key
   };
   ```

3. Save the file. (The `COMPANY` section further down already has the
   Nojom logo and name set up — you only need to touch `SUPABASE_CONFIG`
   unless you want to change the logo or company name later; see the
   comments in that file.)

---

## Part 4 — Put the website online (free, no developer account needed)

This uses **Netlify Drop**, a free service that puts a folder of files
online instantly with a public link — no coding, no command line.

1. Go to **https://app.netlify.com/drop** in your browser.
2. From this package, select the **`index.html`**, **`config.js`**, and
   **`app.js`** files (all three, not the `supabase` folder or this
   README) and drag them into the box on that page.
   - If your file browser lets you select multiple files, select all
     three and drag them together. If it only lets you drag one at a
     time, that's fine too — drop them one after another onto the same
     box.
3. Within a few seconds, Netlify will give you a live public link like
   `https://random-name-12345.netlify.app`. **That link is your Hiring
   Request Portal** — anyone with it can submit a request, and your three
   approvers can sign in from it.
4. Test it right away: open the link, submit a test hiring request, then
   sign in as your HR Manager account and confirm you can see and approve
   it.

**Making the link permanent and giving it a nicer name:** a link created
by dragging files in (without an account) is temporary and can expire.
To keep it permanently and pick a custom subdomain (e.g.
`nojom-hiring.netlify.app`):

1. Click **"Claim this site"** / **"Sign up to save this site"** on the
   confirmation page (or create a free account at netlify.com first, then
   redo the drag-and-drop from your account's dashboard so it's
   saved to your account).
2. Once claimed, go to **Site settings → Change site name** to pick a
   custom `*.netlify.app` address.
3. (Optional, later) **Site settings → Domain management** lets you point
   your own domain (e.g. `hiring.nojom.com`) at the site if you'd like.

**Updating the site later** (e.g. after changing the logo or company name
in `config.js`, or if we ship an update to `app.js`): go to your site's
page on netlify.com and drag the updated file(s) onto the same deploy
area — it takes seconds and the link stays the same.

---

## How the security works (in plain terms)

- **Submitting a request never requires an account.** Anyone with the
  link can fill out and submit the form.
- **Only the three approver accounts you create can see the list of
  submitted requests at all.** A random visitor — even if they guess or
  inspect the website's code — cannot read anyone else's hiring requests.
- **Every approval action is re-checked by the database, not just the
  website.** For example, a Final Approver account physically cannot
  approve the HR Manager step, and an HR Manager cannot approve a request
  a second time — even if someone tried to script around the website's
  buttons, the database itself refuses the action.
- **A draft in progress is protected by a private link-like token** stored
  only in the submitter's own browser, so nobody else can open or edit
  someone else's unfinished draft.
- **The `anon` key in `config.js` is meant to be public** — this is how
  Supabase is designed to work. The real protection is the row-level
  security rules defined in `supabase/schema.sql`, which is why that file
  must be run before the site is usable.

## What's in this package

```
index.html            The website (open via the Netlify link, not directly as a file)
config.js             Your Supabase connection + company/logo settings — edit this
app.js                Application logic — no need to edit
supabase/schema.sql   Database setup script — paste into Supabase SQL Editor once
README.md             This guide
```

## Troubleshooting

- **"Not connected yet" banner on the live site** — `config.js` still has
  the placeholder `YOUR-PROJECT-REF` / `YOUR-ANON-PUBLIC-KEY` values. Go
  back to Part 3.
- **Sign-in says "Invalid login credentials"** — double check the email
  and password you set in Authentication → Users, or reset the password
  from there.
- **A signed-in approver sees "Your account isn't set up as an approver
  yet"** — their Supabase Auth user exists, but no matching row was added
  to `public.profiles` (Part 2, step 4). Run the `insert into
  public.profiles ...` statement for them.
- **Changes to `config.js` don't show up** — make sure you re-dragged the
  updated file onto your Netlify site (Part 4, "Updating the site later")
  and hard-refresh the page (Ctrl/Cmd+Shift+R).
