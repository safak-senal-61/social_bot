import { withApiLog } from "@/lib/api/with_log";
// app/api/history/route.ts
import { NextResponse } from "next/server";
import { getHistory } from "@/lib/storage/db";

async function GETHandler() {
  try {
    const history = getHistory();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export const GET = withApiLog("history", GETHandler);
