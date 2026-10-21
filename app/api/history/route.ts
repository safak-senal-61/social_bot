// app/api/history/route.ts
import { NextResponse } from "next/server";
import { getHistory } from "@/lib/storage/db";

export async function GET() {
  try {
    const history = getHistory();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
