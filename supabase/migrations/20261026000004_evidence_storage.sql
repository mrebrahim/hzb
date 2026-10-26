-- صور إثبات المهام: bucket خاص (مش public). العضو يرفع في فولدر باسمه، والمنسقين يشوفوا.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy evidence_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy evidence_select on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff()));
