import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

function getOrigin(request: NextRequest): string {
  const host  = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000"
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/dashboard"
  const origin = getOrigin(request)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
