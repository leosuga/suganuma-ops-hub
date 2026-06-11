"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { uploadNoteAttachment, deleteNoteAttachment } from "@/lib/storage"
import { logger } from "@/lib/logger"
import type { Attachment } from "@/lib/types/note"

export { type Attachment } from "@/lib/types/note"

interface NoteAttachmentsProps {
  noteId: string
  ownerId: string
  attachments: Attachment[]
  onChange: (attachments: Attachment[]) => void
  editable?: boolean
}

export function NoteAttachments({ noteId, ownerId, attachments, onChange, editable }: NoteAttachmentsProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const newAttachments: Attachment[] = []

    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          logger.warn("NoteAttachments", "File too large", { name: file.name, size: file.size })
          continue
        }
        const result = await uploadNoteAttachment(file, noteId, ownerId)
        newAttachments.push(result)
      }
      onChange([...attachments, ...newAttachments])
    } catch (err) {
      logger.error("NoteAttachments", "Upload failed", { error: String(err) })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemove(index: number) {
    const att = attachments[index]
    if (!att) return
    try {
      await deleteNoteAttachment(att.path)
      const next = [...attachments]
      next.splice(index, 1)
      onChange(next)
    } catch (err) {
      logger.error("NoteAttachments", "Delete failed", { error: String(err) })
    }
  }

  const isImage = (type: string) => type.startsWith("image/")

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={att.path} className="relative group">
              {isImage(att.type) ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-20 h-20 object-cover rounded-sm border border-border"
                  loading="lazy"
                />
              ) : (
                <div className="w-20 h-20 flex flex-col items-center justify-center border border-border rounded-sm bg-bg px-1">
                  <span className="text-[8px] font-mono text-on-surface/40 text-center truncate w-full">{att.name}</span>
                  <span className="text-[7px] font-mono text-on-surface/20 mt-0.5">{(att.size / 1024).toFixed(0)}KB</span>
                </div>
              )}
              {editable && (
                <button
                  onClick={() => handleRemove(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "h-7 px-3 font-mono text-[9px] font-semibold tracking-wider rounded-sm border transition-colors",
              uploading
                ? "opacity-50 cursor-not-allowed"
                : "text-on-surface/40 border-border hover:border-on-surface/30 hover:text-on-surface/60"
            )}
          >
            {uploading ? "UP..." : "+ ANEXO"}
          </button>
          {uploading && <span className="text-[9px] font-mono text-on-surface/30">Enviando...</span>}
        </div>
      )}
    </div>
  )
}
