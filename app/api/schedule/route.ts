import { withApiLog } from "@/lib/api/with_log";
// app/api/schedule/route.ts
import { NextResponse } from "next/server";
import { getScheduledQueue, removeScheduledItem } from "@/lib/storage/db";

async function GETHandler() {
  try {
    const queue = getScheduledQueue();
    return NextResponse.json({ success: true, queue });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

async function DELETEHandler(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, message: "ID gereklidir" }, { status: 400 });
    }
    const removed = removeScheduledItem(id);
    return NextResponse.json({
      success: !!removed,
      message: removed ? "Zamanlanmış gönderi iptal edildi" : "Gönderi bulunamadı",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export const GET = withApiLog("schedule", GETHandler);
export const DELETE = withApiLog("schedule", DELETEHandler);
