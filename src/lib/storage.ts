"use client"

import { createClient } from "@/lib/supabase/client"

// Bucket privado (migration 0036): sem URL pública permanente, cada leitura
// precisa de uma signed URL. 7 dias é generoso o bastante para não expirar
// entre visitas normais à nota, mas continua sendo uma credencial temporária.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

export async function getNoteAttachmentUrl(path: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from("note-attachments")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data) throw error ?? new Error("Falha ao gerar URL assinada")
  return data.signedUrl
}

export async function uploadNoteAttachment(
  file: File,
  noteId: string,
  ownerId: string
): Promise<{ url: string; path: string; name: string; type: string; size: number }> {
  const supabase = createClient()

  const timestamp = Date.now()
  const path = `${ownerId}/${noteId}/${timestamp}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from("note-attachments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) throw uploadError

  const url = await getNoteAttachmentUrl(path)

  return {
    url,
    path,
    name: file.name,
    type: file.type,
    size: file.size,
  }
}

export async function deleteNoteAttachment(path: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from("note-attachments")
    .remove([path])
  if (error) throw error
}
