ALTER TABLE public.purchase_funnel_events
  DROP CONSTRAINT purchase_funnel_events_event_type_check;

ALTER TABLE public.purchase_funnel_events
  ADD CONSTRAINT purchase_funnel_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'attributed_landing','preview_play','license_selected','buy_now_clicked',
    'checkout_started','purchase_confirmed',
    'free_landing_view','free_lead_captured','free_download'
  ]));

DROP POLICY "Visitors can record client funnel events" ON public.purchase_funnel_events;

CREATE POLICY "Visitors can record client funnel events"
ON public.purchase_funnel_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type = ANY (ARRAY[
    'attributed_landing','preview_play','license_selected','buy_now_clicked',
    'free_landing_view','free_lead_captured','free_download'
  ])
  AND stripe_session_id IS NULL
  AND amount_cents IS NULL
  AND payment_environment IS NULL
  AND char_length(COALESCE(utm_source, '')) <= 100
  AND char_length(COALESCE(utm_medium, '')) <= 100
  AND char_length(COALESCE(utm_campaign, '')) <= 160
  AND char_length(COALESCE(utm_content, '')) <= 160
  AND char_length(COALESCE(session_key, '')) <= 64
);