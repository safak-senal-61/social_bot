// lib/smart_time/scheduler.ts
// Akıllı Paylaşım Saati Önerisi (Smart Time)
// Sosyal medya ve seyahat kitlelerinin haftalık aktiflik ve etkileşim zirvelerine göre hesaplar.

export interface SmartTimeSlot {
  dayOfWeek: number; // 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi
  hour: number;
  minute: number;
  label: string;
  reason: string;
}

// Türkiye günübirlik iş, yevmiye ve eleman arayan kitleler için en yüksek etkileşim pencereleri
const PEAK_SLOTS: SmartTimeSlot[] = [
  // Hafta içi sabah işe başlama & acil eleman duyuruları
  { dayOfWeek: 1, hour: 8, minute: 30, label: "Pazartesi 08:30", reason: "Güne başlarken acil iş ve eleman ilanları" },
  { dayOfWeek: 2, hour: 8, minute: 30, label: "Salı 08:30", reason: "Sabah acil eleman ihtiyacı zirvesi" },
  { dayOfWeek: 3, hour: 8, minute: 30, label: "Çarşamba 08:30", reason: "Hafta ortası günlük iş ilanları" },
  { dayOfWeek: 4, hour: 8, minute: 30, label: "Perşembe 08:30", reason: "Sabah iş duyuruları" },
  { dayOfWeek: 5, hour: 8, minute: 30, label: "Cuma 08:30", reason: "Hafta sonu için acil usta/personel çağrıları" },

  // Hafta içi öğle molaları (İş arayanların ve ek iş bakanların telefon kontrolü)
  { dayOfWeek: 1, hour: 12, minute: 30, label: "Pazartesi 12:30", reason: "Öğle molası iş ve yevmiye arayışı" },
  { dayOfWeek: 2, hour: 12, minute: 30, label: "Salı 12:30", reason: "Öğle molası iş ilanları kontrolü" },
  { dayOfWeek: 3, hour: 12, minute: 30, label: "Çarşamba 12:30", reason: "Öğle molası ek iş fırsatları" },
  { dayOfWeek: 4, hour: 12, minute: 30, label: "Perşembe 12:30", reason: "Hafta sonu iş planlama başlangıcı" },
  { dayOfWeek: 5, hour: 12, minute: 30, label: "Cuma 12:30", reason: "Cuma öğle molası iş duyuruları" },

  // Hafta içi akşam zirveleri (İş çıkışı ek gelir ve ertesi günün yevmiyeli işleri)
  { dayOfWeek: 1, hour: 19, minute: 30, label: "Pazartesi 19:30", reason: "Akşam iş çıkışı: Yarının yevmiyeli işleri" },
  { dayOfWeek: 2, hour: 19, minute: 30, label: "Salı 19:30", reason: "Akşam prime time: Günlük eleman ilanları" },
  { dayOfWeek: 3, hour: 19, minute: 30, label: "Çarşamba 19:30", reason: "Akşam iş ve usta arayışı" },
  { dayOfWeek: 4, hour: 19, minute: 30, label: "Perşembe 19:30", reason: "Cuma ve hafta sonu için acil işler" },
  { dayOfWeek: 5, hour: 19, minute: 30, label: "Cuma 19:30", reason: "🔥 Hafta sonu acil iş ve etkinlik personeli zirvesi" },

  // Hafta sonu: Cumartesi ve Pazar iş ilanları
  { dayOfWeek: 6, hour: 11, minute: 0, label: "Cumartesi 11:00", reason: "Hafta sonu ek iş ve usta ihtiyaçları" },
  { dayOfWeek: 6, hour: 19, minute: 30, label: "Cumartesi 19:30", reason: "Pazar günübirlik yevmiye ilanları" },
  { dayOfWeek: 0, hour: 11, minute: 30, label: "Pazar 11:30", reason: "⭐ Pazar eleman arayanlar ve iş arayanlar zirvesi" },
  { dayOfWeek: 0, hour: 19, minute: 0, label: "Pazar 19:00", reason: "Pazartesi haftalık iş başlangıcı planlaması" },
];

export function getNextSmartTime(): {
  targetDate: Date;
  buttonLabel: string;
  reason: string;
  timestampMs: number;
} {
  const now = new Date();
  const minFutureMs = 25 * 60 * 1000; // En az 25 dakika sonra olmalı

  let bestSlot: { date: Date; slot: SmartTimeSlot } | null = null;
  let minDiff = Infinity;

  // Önümüzdeki 7 günü tara
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const candidateDay = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = candidateDay.getDay();

    const matchingSlots = PEAK_SLOTS.filter((s) => s.dayOfWeek === dayOfWeek);

    for (const slot of matchingSlots) {
      const candidateDate = new Date(candidateDay);
      candidateDate.setHours(slot.hour, slot.minute, 0, 0);

      const diff = candidateDate.getTime() - now.getTime();
      if (diff >= minFutureMs && diff < minDiff) {
        minDiff = diff;
        bestSlot = { date: candidateDate, slot };
      }
    }
  }

  // Eğer bulunamazsa 2 saat sonrasını ayarla
  if (!bestSlot) {
    const fallbackDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return {
      targetDate: fallbackDate,
      buttonLabel: `⏰ 2 Saat Sonra (${fallbackDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })})`,
      reason: "Önerilen zaman",
      timestampMs: fallbackDate.getTime(),
    };
  }

  const isToday = bestSlot.date.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const isTomorrow = bestSlot.date.toDateString() === tomorrow.toDateString();

  const timeStr = bestSlot.date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  let dayName = bestSlot.date.toLocaleDateString("tr-TR", { weekday: "long" });

  let prefix = dayName;
  if (isToday) prefix = "Bugün";
  else if (isTomorrow) prefix = "Yarın";

  return {
    targetDate: bestSlot.date,
    buttonLabel: `⭐ Akıllı Saat: ${prefix} ${timeStr}`,
    reason: bestSlot.slot.reason,
    timestampMs: bestSlot.date.getTime(),
  };
}
