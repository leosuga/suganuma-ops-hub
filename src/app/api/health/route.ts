import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("profile").select("id").limit(1)
    if (error) throw error
    return NextResponse.json({ status: "ok", db: "ok", version: process.env.npm_package_version ?? "0.1.0" })
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 })
  }
}
