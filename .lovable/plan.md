
# Invite-Only Access via Stripe Purchase

Lock down account creation so only paying customers can sign up. After a successful Stripe purchase, the webhook generates a unique single-use claim link (Skool-style) and emails it to the customer. Existing accounts keep working as-is.

## How it works (user POV)

1. Visitor lands on the public site, hits "Subscribe", pays through Stripe Checkout (no account required yet).
2. Stripe webhook fires → backend creates an `invite` record + unique token, emails customer: *"Your invite to KRAZYJAYDOTCOM"* with link `https://krazyjay.com/claim/{token}`.
3. Customer clicks link → `/claim/{token}` page validates the token and shows a "Create your account" form with email pre-filled and locked.
4. They set a password → account is created, linked to their Stripe customer, token is burned (`used_at` set), redirected into `/beats`.
5. Public `/signup` page is removed. Anyone hitting it gets sent to the pricing page.

## What changes

### Database (new migration)
- New table `invites`:
  - `token` (unique, 32-char random), `email`, `stripe_customer_id`, `stripe_subscription_id`, `tier`, `expires_at` (now + 7 days), `used_at`, `claimed_by_user_id`
- RLS: no client access. All reads/writes happen server-side via service role.
- New SECURITY DEFINER function `claim_invite(_token text, _user_id uuid)` that atomically validates + marks used + links profile to Stripe customer + sets subscription tier/status.

### Stripe checkout flow (pre-account)
- `src/lib/payments.functions.ts` — currently `createCheckoutSession` requires auth. Add a new `createGuestCheckoutSession` server fn (no auth middleware) that:
  - Takes `priceId` + `email` (collected on the pricing page).
  - Creates Stripe customer with email, no `userId` metadata yet.
  - Returns embedded checkout `client_secret`.
- Pricing page (`src/components/pricing.tsx`) → "Get Started" opens an email capture modal → routes to a public `/checkout?plan=...` page (move out of `_authenticated`).

### Webhook (`src/routes/api/public/payments/webhook.ts`)
- On `checkout.session.completed` (or `customer.subscription.created`):
  - If the customer doesn't already have a linked `profiles.id`, generate an invite token, insert into `invites`, send claim email.
  - If they already have an account (existing user re-subscribing), skip invite — just grant credits as today.
- Keep existing `invoice.paid` credit-grant logic untouched.

### Claim page (new)
- `src/routes/claim.$token.tsx` — public route.
  - Loader/server fn `validateInvite(token)` returns `{ email, tier, expired, used }` or 404.
  - Form: password + confirm. Submits to `claimInvite` server fn that calls `supabase.auth.admin.createUser` (via admin client) with email + password + email_confirm: true, then runs `claim_invite()` SQL fn, then signs the user in client-side.
  - Error states: expired, already used, invalid → friendly message with "Contact support" + "Resend invite" link (admin can regenerate).

### Disable open signup
- `src/routes/signup.tsx` → replace with redirect to `/#pricing` (or delete and add a redirect route).
- Remove "Sign up" links from `site-nav.tsx` / login page; replace with "Subscribe to get access".
- Login page stays as-is (existing users still log in normally).

### Email
- Need a transactional email for the invite. Use scaffolded transactional email infra (already configured in this project — `email_send_log`, `enqueue_email` exist). Add new template `invite-claim.tsx` and enqueue from the webhook.
- Email contains: claim link, expiry note ("expires in 7 days"), what they unlocked.

### Admin tooling
- Add `/admin/invites` page: list invites with status (pending / claimed / expired), "Resend" button (regenerates token + re-emails), "Revoke" button.

## Security notes

- Tokens: 32-byte cryptographically random, base64url-encoded. Stored hashed? — for v1, store plaintext (it's single-use + 7-day expiry + tied to email). Can upgrade to hashed later.
- `claim_invite` runs as SECURITY DEFINER so it can write across tables atomically; validates token + expiry + unused inside the function.
- Webhook signature verification stays as-is (already implemented).
- Existing `/signup` removal closes the only path to a free account.

## Out of scope for this pass
- Hashed tokens (defer)
- Auto-revoking access when subscription cancels (already partially handled by `subscription_status`; a separate pass can enforce in `_authenticated` guard)
- The beat-funnel landing pages from earlier conversation (separate plan)

## Files touched

**New**
- `supabase/migrations/<ts>_invites.sql`
- `src/routes/claim.$token.tsx`
- `src/lib/invites.functions.ts`
- `src/routes/_authenticated/admin/invites.tsx`
- `supabase/functions/_shared/email-templates/invite-claim.tsx`

**Edited**
- `src/lib/payments.functions.ts` (add guest checkout)
- `src/routes/api/public/payments/webhook.ts` (issue invite + send email)
- `src/components/pricing.tsx` (email-first checkout flow)
- `src/routes/checkout.tsx` (move out of `_authenticated`, accept guest)
- `src/routes/signup.tsx` (redirect to pricing)
- `src/components/site-nav.tsx` (remove Sign up CTA)
- `src/routes/_authenticated/admin/index.tsx` (link to invites admin)
