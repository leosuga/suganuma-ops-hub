import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/capture — destino do Web Share Target da PWA.
//
// No iPhone, compartilhar um texto/link de qualquer app para o "Ops Hub"
// (instalado na tela de início) cai aqui: o SO envia o conteúdo como
// form-urlencoded (title/text/url) e a gente joga direto no Inbox, que é a
// fila de triagem. Sem isso, capturar no celular exigia abrir o app.
//
// O SW não intercepta /api/* (early return no fetch handler) → o POST chega
// íntegro aqui.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), 303)
  }

  const form = await req.formData().catch(() => null)
  const pick = (key: string) => {
    const v = form?.get(key)
    return typeof v === "string" ? v.trim() : ""
  }

  const title = pick("title")
  const text = pick("text")
  const url = pick("url")

  // O SO manda title e text separados; a URL vai na própria linha para
  // continuar clicável/triável depois.
  const body = [text || title, url].filter(Boolean).join("\n").trim()

  if (!body) {
    return NextResponse.redirect(new URL("/inbox?captured=empty", req.url), 303)
  }

  const { error } = await supabase.from("inbox_item").insert({
    owner_id: user.id,
    content: body,
    source: "manual",
  })

  if (error) {
    return NextResponse.redirect(new URL("/inbox?captured=erro", req.url), 303)
  }

  return NextResponse.redirect(new URL("/inbox?captured=1", req.url), 303)
}
