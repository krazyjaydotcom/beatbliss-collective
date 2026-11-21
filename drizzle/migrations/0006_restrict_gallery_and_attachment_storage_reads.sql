DROP POLICY "Public can read home_gallery objects" ON storage.objects;
CREATE POLICY "Admins can read home_gallery objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'home_gallery' AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY "Public can read beat attachments" ON storage.objects;
CREATE POLICY "Admins can read beat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'beat-attachments' AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));