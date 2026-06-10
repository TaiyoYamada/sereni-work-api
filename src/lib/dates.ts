/** 事業所のタイムゾーン（日本の事業所のみを想定） */
const FACILITY_TIME_ZONE = "Asia/Tokyo";

/** 今日の日付を YYYY-MM-DD で返す（Lambda は UTC で動くため必ずこれを使う） */
export function todayInFacilityTz(now: Date = new Date()): string {
  // sv-SE ロケールは YYYY-MM-DD 形式
  return now.toLocaleDateString("sv-SE", { timeZone: FACILITY_TIME_ZONE });
}
