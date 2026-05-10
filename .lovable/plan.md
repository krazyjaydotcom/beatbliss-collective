## Goal

Turn the landing page into a working subscription beat store with two plans:
- **Artist / Creator** — $37/mo (already exists in your Stripe)
- **Label** — $97/mo (needs to be created)

Using **Lovable Payments (built-in Stripe)** so there are no API keys to copy from your other app — billing is handled inside Lovable.

## Heads up before we start

- **Pro plan required** — Lovable Payments needs a Pro subscription.
- **Your existing $37 product won't carry over.** Lovable Payments creates its own connected Stripe environment for this project. Both products will be created fresh inside it (test mode first, then live after you verify your account). Your other app's products stay untouched.
- If you'd rather reuse your exact existing Stripe account/products, that requires the BYOK Stripe integration where you paste your secret key — say the word and I'll switch to that path instead.

## Plan

### 1. Enable Lovable Cloud
Provisions database, auth, and server runtime. Needed to store users, their plan, and Stripe customer/subscription IDs.

### 2. Enable Lovable Payments (Stripe)
Runs the eligibility check, then enables the built-in Stripe integration. Creates a test environment immediately.

### 3. Create both products in Stripe
- Artist / Creator — $37/month recurring
- Label — $97/month recurring

### 4. Add authentication
- Email + password sign up / log in
- `/login` and `/signup` routes
- `_authenticated` layout for gated pages

### 5. Add `/account` page
Shows the user's current plan, renewal date, and a "Manage billing" button (Stripe customer portal).

### 6. Wire up checkout
- "Get Started" buttons on each pricing card create a Stripe Checkout session for that plan
- Success returns user to `/account`
- Webhook at `/api/public/stripe-webhook` updates the user's subscription status in the database

### 7. Gate beat content
Add a `subscription_tier` column on profiles (`none` / `artist` / `label`). Future beats/downloads pages can check this.

## Technical details

- **Tables:** `profiles` (id, email, stripe_customer_id, subscription_tier, subscription_status, current_period_end), with RLS so users only read their own row.
- **Server functions:** `createCheckoutSession`, `createPortalSession`, `getMyAccount` — all under `requireSupabaseAuth`.
- **Webhook route:** `src/routes/api/public/stripe-webhook.ts` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **Label tier** gets stored as `label` so we can later expose label-only beats and team seats.

## Out of scope for this round

Beat catalog, audio player, downloads, team seats for Label plan. Those come after subscriptions are working end-to-end.

## Confirm before I build

1. OK to create the $37 product fresh in this project's Stripe (instead of reusing the one in your other app)?
2. OK to use Lovable Payments? (Or do you want BYOK Stripe with your existing secret key instead?)
