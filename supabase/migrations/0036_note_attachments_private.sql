-- Migration 0036: Torna o bucket note-attachments privado.
--
-- O bucket foi criado público (0029) e as policies de RLS ficaram comentadas —
-- nunca foram aplicadas. Bucket público + getPublicUrl() gera URL permanente e
-- sem autenticação para qualquer anexo. Como o bucket tem RLS habilitado por
-- padrão e nenhuma policy de INSERT existia, uploads de usuários autenticados
-- também falhavam (nenhum objeto foi gravado até hoje — confirmado antes desta
-- migration). Esta migration corrige os dois problemas: bucket privado +
-- policies reais, e o código passa a usar createSignedUrl() (ver src/lib/storage.ts).

update storage.buckets set public = false where id = 'note-attachments';

create policy "note_attachments_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_attachments_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_attachments_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
