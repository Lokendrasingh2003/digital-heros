# Digital Heroes — Functionality and Features

Digital Heroes is a membership web app for golfers. Members pay a monthly or yearly fee, record Stableford scores, direct part of that fee to a charity, and enter a monthly five-number prize draw.

The product has three kinds of users: a public visitor, a registered member, and an administrator.

The app runs locally with the site at `http://localhost:5173` and the API at `http://localhost:5000`.

## Public site

Anyone can browse these pages without an account.

- **Home** (`/`) explains what a member does, how the monthly draw pays out, and which charity is in the spotlight. It also shows the live monthly and yearly prices from Stripe.
- **The draw** (`/how-it-works`) explains random and score-weighted draws, the three match tiers, jackpot rollover, and winner verification.
- **Charities** (`/charities`) lists active charities with search and a category filter. Featured charities are marked.
- **Charity profile** (`/charities/:id`) shows the description, image, website, and upcoming events. A logged-in visitor can start an independent donation from this page.
- **Membership** (`/subscribe`) shows the monthly and yearly plans and starts Stripe checkout. A visitor who is not logged in is sent to signup first.
- **Signup** (`/signup`) collects name, email, password, and a required charity. The charity share starts at 10%.
- **Login** (`/login`) signs the person in. Administrators are sent to the admin area. Everyone else goes to the dashboard.

Navigation stays on every public page: the draw, charities, membership, login or the dashboard, and logout.

## Accounts and security

- Passwords are stored as hashes. The login response is the same for an unknown email and a wrong password.
- A signed token lasts one hour and is kept in the browser. Expired or missing tokens return the person to login.
- Each account has a role of `user` or `admin`. Admin pages refuse everyone else.
- Members can change their display name from the dashboard.

## Membership and payments

- Plans are **monthly** and **yearly**. Prices are read from Stripe, not hard-coded in the page.
- Checkout is a Stripe subscription. The member’s email is attached to the session.
- Stripe webhooks keep the local record in step: checkout completed, subscription created, updated, or deleted, and invoice paid or failed.
- Statuses used in the app are active, past due, cancelled, and inactive. Access counts as active only while the status is active and the current period has not ended.
- A member, or an admin acting for them, can cancel renewal. Access continues until the period already paid for ends.
- The dashboard shows the plan, status, amount, and the next billing date or the date access ends.

Without an active membership, adding or editing scores and entering a draw are blocked. Older scores, past entries, and winnings stay visible.

## Scores

- Scores use the Stableford format. Each score is a whole number from 1 to 45 and must include a valid date. Future dates are not accepted.
- Only one score is allowed per date. Saving the same date updates that score. A different date that already exists must be edited or deleted instead of duplicated.
- Only the five most recent dates are kept. A sixth date removes the oldest. Deleting a score does not restore scores that were already removed.
- Scores are listed newest date first.
- Members edit or delete a score from the dashboard. Admins can add or delete scores on a member’s behalf.

## Charity

- Every new account chooses an active charity. The minimum share of the membership fee is 10%. The member can raise that share up to 100% later.
- The dashboard shows the chosen charity and a slider for the share.
- **Independent donations** are separate from the membership and from the draw. The member picks an amount of at least 1 USD and pays through Stripe. The donation is stored as pending until Stripe confirms it, then marked paid.
- The public directory supports search by name, description, and category, plus a category filter.
- Each charity can have a description, category, image, website, featured flag, and active flag.
- Charity profiles list events with a title, description, and date.

## Monthly draw

- Numbers run from 1 to 45. A member picks exactly five unique numbers for a draw that is still a draft.
- A member can enter a given draw only once. Entries close when the draw is simulated.
- The public draw board lists open draft draws without revealing numbers, and published draws with their numbers and prize tiers.
- The dashboard shows draws already entered, the member’s numbers, the published numbers, and how many numbers matched.

Two draw methods:

- **Random.** Each number from 1 to 45 has an equal chance.
- **Weighted.** Numbers that appear more often as Stableford scores are more likely to be drawn. A number that has never been scored still keeps a small chance.

An administrator creates one draw per month, chooses the method, runs a simulation, and publishes in a separate step. Simulation does not create winners. Publishing does.

## Prize pool

- Half of each active subscription is the fixed prize share.
- The member’s charity percentage is taken first. If that share is above 50%, the prize share shrinks so the charity gift is not reduced. Whatever remains stays with the platform.
- An unclaimed jackpot from the previous published draw is added to the new pool. A rollover can be claimed by only one later draw.
- The pool is split before winners are named:
  - **5 numbers:** 40%. If nobody matches, this share rolls into the next month.
  - **4 numbers:** 35%, split evenly among everyone in that tier.
  - **3 numbers:** the remaining 25%, split evenly among everyone in that tier.
- Fewer than three matches pays nothing.
- Subscriptions in more than one currency stop a simulation, so pools are not mixed.

## Winnings and verification

- After a draw is published, each winning entry becomes a winner record with a match tier and a prize amount.
- The dashboard shows total awarded money, excluding rejected prizes, plus each prize’s verification and payment status.
- A winner submits a screenshot as a URL. They can replace it while the submission is still pending or has been rejected. Approved or paid prizes cannot be replaced.
- An admin approves or rejects the proof, then marks an approved prize as paid. Payment does not happen automatically. A prize cannot be marked paid before it is approved, and it cannot be reviewed before proof is uploaded.
- Status path: verification moves through pending, approved, or rejected. Payment moves from pending to paid.

## Member dashboard

`/dashboard` is available after login and includes:

- Subscription status, renewal or end date, plan buttons, and cancel-at-period-end.
- Name editing.
- Score entry, edit, and delete, with the latest five rounds.
- Selected charity, contribution percentage, and independent donation, plus past donations.
- Open draw, five-number picker, and participation history.
- Winnings total, payment status, and proof upload.

## Admin area

`/admin` is limited to the admin role.

- **Reports.** Member count, active monthly and yearly subscriptions, total of published prize pools, charity money from memberships and paid donations, draw counts by status, and winner counts by verification and payout.
- **Users.** List of accounts with their latest subscription. Edit name, role, charity, and contribution percentage. Add or delete that member’s scores. Cancel their subscription at the period end.
- **Draws.** Create a draft for a month, choose random or weighted, simulate, and publish. Each draw shows eligible subscribers, pool size, rollover in and out, and the five numbers after simulation.
- **Charities.** Create, edit, feature, activate, deactivate, and delete a charity. A charity that already has donations cannot be deleted and should be deactivated instead. Add and remove charity events.
- **Winners.** Full list with member, draw month, tier, amount, and proof link. Approve, reject, or mark paid.

## Data stored

The database holds users, subscriptions, golf scores, charities, charity events, donations, draws, draw entries, prize tiers, and winners.

## What this build does not include

- The site is not deployed to a public URL in this workspace. The product brief asks for a new Vercel account and a new Supabase project.
- Stripe must send webhooks to the API for a payment to update membership or donation status.
- Winner proof is a link to a screenshot, not a file uploaded into the app.
