// lib/ui/navigation.ts
// Panel ve debug sayfasının ortak sol menü yapısı. Sayılar (geçmiş, kuyruk vb.) panel sayfası tarafından eklenir.
import type { RailGroup } from "@/components/Rail";

export type TabId =
  | "overview"
  | "history"
  | "schedule"
  | "aistudio"
  | "autoreply"
  | "telegram"
  | "facebook"
  | "linkedin"
  | "cloudinary"
  | "features";

export const TAB_TITLES: Record<TabId, string> = {
  overview: "Genel durum",
  history: "Paylaşım geçmişi",
  schedule: "Zamanlanmış kuyruk",
  aistudio: "AI stüdyosu",
  autoreply: "Otomatik yanıt",
  telegram: "Telegram",
  facebook: "Facebook ve Instagram",
  linkedin: "LinkedIn",
  cloudinary: "Cloudinary",
  features: "Yapay zeka ve filigran",
};

export const TAB_LEADS: Record<TabId, string> = {
  overview: "Bağlantıların durumu ve hızlı test paylaşımı.",
  history: "Telegram ve panelden yapılan son paylaşımlar.",
  schedule: "Zamanı gelince yayınlanacak gönderiler.",
  aistudio: "Tarifinize göre ücretsiz görsel, başlık ve etiket üretin.",
  autoreply: "Gelen yorumlara anahtar kelimeye göre otomatik yanıt verin.",
  telegram: "Bot anahtarı ve botu kullanabilecek kişiler.",
  facebook: "Sayfa ve Instagram hesabı erişim bilgileri.",
  linkedin: "LinkedIn şirket sayfası erişimi.",
  cloudinary: "Medya dosyalarının yüklendiği depolama hesabı.",
  features: "Yapay zeka, filigran ve bildirim tercihleri.",
};

export function buildRailGroups(counts: Partial<Record<TabId, number>> = {}): RailGroup[] {
  const item = (id: TabId) => ({ id, label: TAB_TITLES[id], count: counts[id] });
  return [
    { title: "Paylaşım", items: [item("overview"), item("history"), item("schedule"), item("aistudio"), item("autoreply")] },
    { title: "Bağlantılar", items: [item("telegram"), item("facebook"), item("linkedin"), item("cloudinary")] },
    { title: "Ayarlar", items: [item("features")] },
  ];
}

export const RAIL_GROUPS: RailGroup[] = buildRailGroups();
