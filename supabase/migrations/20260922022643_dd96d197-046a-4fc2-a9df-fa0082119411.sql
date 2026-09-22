DROP INDEX IF EXISTS public.purchase_funnel_events_paid_session_unique;
CREATE UNIQUE INDEX purchase_funnel_events_paid_session_beat_unique
  ON public.purchase_funnel_events (payment_environment, stripe_session_id, beat_id)
  WHERE event_type = 'purchase_confirmed' AND stripe_session_id IS NOT NULL AND beat_id IS NOT NULL;