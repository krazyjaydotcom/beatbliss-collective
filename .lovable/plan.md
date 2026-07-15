## Goal

Make the app emails you care about actually deliver and make the admin area show whether email sending is working instead of silently saying “queued.”

This covers:
- Free beat download email
- Purchase buyer email
- Admin sale notification email
- Exclusive/custom inquiry email
- Admin test emails for all of the above

## What I found

Your sender domain is verified and the live queue is healthy, but the recent messages are being rejected before delivery with:

```text
400 missing_unsubscribe — Transactional emails must include an unsubscribe_token
```

Those messages retried 5 times and then became permanently failed, so they will not arrive unless the action is triggered again after the fix.

## Plan

1. **Fix the shared email enqueue helper**
   - Update the shared beat email queue helper so every outbound app email includes a valid unsubscribe token.
   - Reuse or create the token from the existing email unsubscribe table.
   - Keep the existing sender domain, from address, queue, templates, purchase logic, download logic, webhook logic, and inquiry routing intact.

2. **Make test emails truthfully report status**
   - Update the admin test email function so it confirms the message was inserted into the email queue/log instead of only returning “ok” after calling the helper.
   - If queueing fails, return the real error to the admin UI.

3. **Add an admin validation view**
   - Add a compact “Email delivery status” panel in the existing admin beat landing email-test area.
   - Show recent email attempts with: type, recipient, latest status, timestamp, and error message if failed.
   - Show simple counts for recent sent / failed / pending messages so you can validate if the system is working without waiting blindly.
   - Deduplicate by message id so the same email retry doesn’t appear as several separate emails.

4. **Retest path**
   - After implementation, use the admin tester to send a fresh test email.
   - Check the email log status afterward; successful new messages should go `pending` then `sent`, not `failed` or `dlq`.

## Files expected to change

- `src/lib/beat-landing-email.server.ts` — fix shared queue payloads for all beat-related emails.
- `src/lib/beat-landing.functions.ts` — return useful status for test emails and expose recent email status to admin.
- `src/routes/_authenticated/admin/beat-landing.tsx` — display the validation/status panel.

## Not changing

- Beat landing layout
- Checkout/payment behavior
- Webhook delivery logic
- Pricing logic
- Member/signup/subscription behavior
- Database schema
- Homepage content
