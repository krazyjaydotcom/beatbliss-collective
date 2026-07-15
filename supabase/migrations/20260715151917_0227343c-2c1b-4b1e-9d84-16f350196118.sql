
CREATE POLICY "Admins can upload beat attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'beat-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update beat attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'beat-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete beat attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'beat-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read beat attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'beat-attachments');
