// lib/storage/db.ts
import fs from "fs";
import path from "path";

export interface PostRecord {
  id: string;
  createdAt: string;
  caption: string;
  mediaType: "photo" | "video" | "carousel";
  targetType?: "feed" | "story";
  mediaUrl?: string;
  albumUrls?: string[];
  localPath?: string;
  scheduledAt?: string;
  status: "published" | "scheduled" | "failed";
  platforms: {
    facebook?: { success: boolean; id?: string; error?: string };
    instagram?: { success: boolean; id?: string; error?: string };
    linkedin?: { success: boolean; id?: string; error?: string };
  };
}

export interface ScheduledItem {
  id: string;
  userId: number;
  localPath: string;
  albumPaths?: string[];
  caption: string;
  applyWatermark: boolean;
  targetType?: "feed" | "story";
  scheduledAt: number; // Unix timestamp in ms
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "posts_history.json");
const SCHEDULE_FILE = path.join(DATA_DIR, "scheduled_queue.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getHistory(): PostRecord[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as PostRecord[];
  } catch {
    return [];
  }
}

export function addHistory(record: PostRecord) {
  ensureDir();
  const list = getHistory();
  list.unshift(record); // En yeni en başta
  // Son 200 gönderiyi sakla
  const trimmed = list.slice(0, 200);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
}

export function getScheduledQueue(): ScheduledItem[] {
  ensureDir();
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, "utf-8");
    return JSON.parse(raw) as ScheduledItem[];
  } catch {
    return [];
  }
}

export function addScheduledItem(item: ScheduledItem) {
  ensureDir();
  const queue = getScheduledQueue();
  queue.push(item);
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(queue, null, 2), "utf-8");
}

export function removeScheduledItem(id: string): ScheduledItem | undefined {
  ensureDir();
  const queue = getScheduledQueue();
  const idx = queue.findIndex((i) => i.id === id);
  if (idx !== -1) {
    const removed = queue.splice(idx, 1)[0];
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(queue, null, 2), "utf-8");
    return removed;
  }
  return undefined;
}
