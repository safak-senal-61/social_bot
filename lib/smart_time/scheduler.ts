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

// Türkiye seyahat & günübirlik kitleleri için en yüksek etkileşim pencereleri
const PEAK_SLOTS: SmartTimeSlot[] = [
  // Hafta içi öğle molaları (İş arasında telefon kontrolü)
  { dayOfWeek: 1, hour: 12, minute: 30, label: "Pazartesi 12:30", reason: "Öğle molası gezi keşfi" },
  { dayOfWeek: 2, hour: 12, minute: 30, label: "Salı 12:30", reason: "Öğle molası gezi keşfi" },
  { dayOfWeek: 3, hour: 12, minute: 30, label: "Çarşamba 12:30", reason: "Hafta ortası dinlenme" },
  { dayOfWeek: 4, hour: 12, minute: 30, label: "Perşembe 12:30", reason: "Hafta sonu planlama başlangıcı" },
  
  // Hafta içi akşam zirveleri (Eve dönüş & sosyal medya prime time)
  { dayOfWeek: 1, hour: 20, minute: 0, label: "Pazartesi 20:00", reason: "Akşam prime time" },
  { dayOfWeek: 2, hour: 20, minute: 0, label: "Salı 20:00", reason: "Akşam prime time" },
  { dayOfWeek: 3, hour: 20, minute: 0, label: "Çarşamba 20:00", reason: "Akşam prime time" },
  { dayOfWeek: 4, hour: 20, minute: 30, label: "Perşembe 20:30", reason: "Hafta sonu rota belirleme" },
  
  // Cuma: Hafta sonu heyecanı ve en yüksek bilet/tur etkileşimi
  { dayOfWeek: 5, hour: 12, minute: 30, label: "Cuma 12:30", reason: "Cuma öğle molası rotaları" },
  { dayOfWeek: 5, hour: 19, minute: 30, label: "Cuma 19:30", reason: "🔥 Hafta sonu öncesi en yüksek etkileşim" },

  // Cumartesi: Sabah yola çıkış ve akşam pazar planı
  { dayOfWeek: 6, hour: 10, minute: 30, label: "Cumartesi 10:30", reason: "Sabah gezi ilhamı" },
  { dayOfWeek: 6, hour: 20, minute: 30, label: "Cumartesi 20:30", reason: "Pazar günübirlik rota planlaması" },

  // Pazar: Sabah kahve saati ve akşam kapanış
  { dayOfWeek: 0, hour: 11, minute: 0, label: "Pazar 11:00", reason: "⭐ Pazar keşif zirvesi (En yüksek görünürlük)" },
  { dayOfWeek: 0, hour: 20, minute: 0, label: "Pazar 20:00", reason: "Pazar akşamı dinlenme ve kaydetmeler" },
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
