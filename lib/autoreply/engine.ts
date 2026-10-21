// lib/autoreply/engine.ts
// Facebook ve Instagram yorumlarına otomatik yanıt (Auto-Reply) motoru

import fs from "fs";
import path from "path";
import { facebookPublisher } from "@/lib/publishers/facebook";
import { instagramPublisher } from "@/lib/publishers/instagram";
import { logEvent } from "@/lib/storage/logger";
import { config } from "@/lib/config";

export interface AutoReplyRule {
  id: string;
  name: string;
  keywords: string[];
  reply: string;
  enabled: boolean;
}

export interface RepliedCommentRecord {
  commentId: string;
  platform: "facebook" | "instagram";
  authorName?: string;
  commentText: string;
  replyText: string;
  repliedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const RULES_FILE = path.join(DATA_DIR, "autoreply_rules.json");
const REPLIED_FILE = path.join(DATA_DIR, "replied_comments.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DEFAULT_RULES: AutoReplyRule[] = [
  {
    id: "rule_price",
    name: "Fiyat & Ücret Soruları",
    keywords: ["fiyat", "ücret", "ne kadar", "kaç para", "tl", "maliyet"],
    reply: "Merhaba! Güncel tur fiyatlarımız, kalkış noktaları ve rezervasyon detayları için profilimizdeki bağlantıyı ziyaret edebilir veya bize DM gönderebilirsiniz! 🚌✨",
    enabled: true,
  },
  {
    id: "rule_location",
    name: "Konum & Neresi Soruları",
    keywords: ["neresi", "nerede", "konum", "hangi şehir", "hangi il", "nerde"],
    reply: "Harika bir lokasyon! Detaylı konum bilgisi, ulaşım rehberi ve rota için profilimizdeki linke göz atabilir ya da bize DM'den yazabilirsiniz. 📍",
    enabled: true,
  },
  {
    id: "rule_details",
    name: "Tur Detayı & Program",
    keywords: ["detay", "bilgi", "nasıl gidilir", "program", "rezervasyon", "kayıt"],
    reply: "Merhaba! Tüm gezi programını ve tur detaylarını size iletmemiz için DM'den mesaj gönderebilirsiniz. Keyifli geziler dileriz! 😊",
    enabled: true,
  },
  {
    id: "rule_praise",
    name: "Övgü & Beğeni",
    keywords: ["harika", "güzel", "muhteşem", "süper", "efsane", "bayıldım"],
    reply: "Beğenmenize çok sevindik! Birbirinden güzel yeni rotalar ve günübirlik gezi keşifleri için takipte kalın! 🌟🌿",
    enabled: true,
  },
];

export class AutoReplyEngine {
  getRules(): AutoReplyRule[] {
    ensureDir();
    if (!fs.existsSync(RULES_FILE)) {
      this.saveRules(DEFAULT_RULES);
      return DEFAULT_RULES;
    }
    try {
      return JSON.parse(fs.readFileSync(RULES_FILE, "utf-8")) as AutoReplyRule[];
    } catch {
      return DEFAULT_RULES;
    }
  }

  saveRules(rules: AutoReplyRule[]): void {
    ensureDir();
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), "utf-8");
  }

  getRepliedHistory(): RepliedCommentRecord[] {
    ensureDir();
    if (!fs.existsSync(REPLIED_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(REPLIED_FILE, "utf-8")) as RepliedCommentRecord[];
    } catch {
      return [];
    }
  }

  private addRepliedRecord(rec: RepliedCommentRecord): void {
    ensureDir();
    const list = this.getRepliedHistory();
    list.unshift(rec);
    const trimmed = list.slice(0, 300); // Son 300 yanıtı tut
    fs.writeFileSync(REPLIED_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  }

  /**
   * Bir yorum metninin aktif kurallardan biriyle eşleşip eşleşmediğini kontrol eder.
   */
  findMatch(commentText: string): string | null {
    if (!commentText) return null;
    const lower = commentText.toLowerCase().trim();
    const rules = this.getRules().filter((r) => r.enabled);

    for (const rule of rules) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          return rule.reply;
        }
      }
    }
    return null;
  }

  /**
   * Arka planda Facebook ve Instagram'ın son gönderilerini tarayıp yeni yorumlara otomatik yanıt verir.
   */
  async checkAndReplyRecentComments(): Promise<{ checked: number; replied: number }> {
    let checkedCount = 0;
    let repliedCount = 0;

    const repliedSet = new Set(this.getRepliedHistory().map((r) => r.commentId));

    // 1. Instagram Yorumları
    if (config.instagram.isConfigured) {
      try {
        const recentMedia = await instagramPublisher.getRecentMedia(5);
        for (const media of recentMedia) {
          const comments = await instagramPublisher.getComments(media.id);
          for (const comm of comments) {
            checkedCount++;
            if (!repliedSet.has(comm.id)) {
              const matchedReply = this.findMatch(comm.text || "");
              if (matchedReply) {
                console.log(`[AutoReply] 💬 Instagram yorumuna yanıt veriliyor: "${comm.text}"`);
                const res = await instagramPublisher.replyComment(comm.id, matchedReply);
                if (res.success) {
                  logEvent("success", "autoreply", `Instagram yorumuna otomatik yanıt verildi (@${comm.from?.username || "kullanıcı"}): "${comm.text.slice(0, 40)}"`, { reply: matchedReply });
                  this.addRepliedRecord({
                    commentId: comm.id,
                    platform: "instagram",
                    authorName: comm.from?.username || "Instagram Kullanıcısı",
                    commentText: comm.text,
                    replyText: matchedReply,
                    repliedAt: new Date().toISOString(),
                  });
                  repliedSet.add(comm.id);
                  repliedCount++;
                } else {
                  logEvent("error", "instagram", `Instagram yorum yanıtlama hatası: ${res.error}`, { commentId: comm.id });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("[AutoReply] Instagram yorum kontrolü uyarısı:", err);
      }
    }

    // 2. Facebook Yorumları
    if (config.facebook.isConfigured) {
      try {
        const recentPosts = await facebookPublisher.getRecentPosts(5);
        for (const post of recentPosts) {
          const comments = await facebookPublisher.getComments(post.id);
          for (const comm of comments) {
            checkedCount++;
            if (!repliedSet.has(comm.id)) {
              const matchedReply = this.findMatch(comm.message || "");
              if (matchedReply) {
                console.log(`[AutoReply] 💬 Facebook yorumuna yanıt veriliyor: "${comm.message}"`);
                const res = await facebookPublisher.replyComment(comm.id, matchedReply);
                if (res.success) {
                  this.addRepliedRecord({
                    commentId: comm.id,
                    platform: "facebook",
                    authorName: comm.from?.name || "Facebook Kullanıcısı",
                    commentText: comm.message,
                    replyText: matchedReply,
                    repliedAt: new Date().toISOString(),
                  });
                  repliedSet.add(comm.id);
                  repliedCount++;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("[AutoReply] Facebook yorum kontrolü uyarısı:", err);
      }
    }

    if (repliedCount > 0) {
      console.log(`[AutoReply] 🌟 Toplam ${repliedCount} adet yeni yoruma otomatik yanıt yazıldı!`);
    }

    return { checked: checkedCount, replied: repliedCount };
  }
}

export const autoReplyEngine = new AutoReplyEngine();
