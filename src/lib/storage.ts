"use client"

import { createClient } from "@/lib/supabase/client"

export async function uploadNoteAttachment(
  file: File,
  noteId: string,
  ownerId: string
): Promise<{ url: string; path: string; name: string; type: string; size: number }> {
  const supabase = createClient()

  const ext = file.name.split(".").pop() || "bin"
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

  const { data: urlData } = supabase.storage
    .from("note-attachments")
    .getPublicUrl(path)

  return {
    url: urlData.publicUrl,
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
