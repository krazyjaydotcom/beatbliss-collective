REVOKE EXECUTE ON FUNCTION public.record_purchase_funnel_event(text, uuid, text, text, text, text, text, text) FROM anon, authenticated;
DROP FUNCTION public.record_purchase_funnel_event(text, uuid, text, text, text, text, text, text);
GRANT INSERT ON public.purchase_funnel_events TO anon, authenticated;
CREATE POLICY "Visitors can record client funnel events"
  ON public.purchase_funnel_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_type IN ('attributed_landing','preview_play','license_selected','buy_now_clicked')
    AND stripe_session_id IS NULL
    AND amount_cents IS NULL
    AND payment_environment IS NULL
    AND char_length(coalesce(utm_source, '')) <= 100
    AND char_length(coalesce(utm_medium, '')) <= 100
    AND char_length(coalesce(utm_campaign, '')) <= 160
    AND char_length(coalesce(utm_content, '')) <= 160
    AND char_length(coalesce(session_key, '')) <= 64
  );