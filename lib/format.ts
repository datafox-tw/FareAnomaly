export function ntd(n: number): string {
  return `NT$${Math.round(n).toLocaleString("en-US")}`;
}

/** "2026-08-16" -> "2026/08/16" */
export function slashDate(iso: string): string {
  return iso.replaceAll("-", "/");
}

/** "2026-08-16" -> "8/16 (週六)" */
export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00+08:00");
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (週${wd})`;
}

/** Human-readable 請假 hint — a reference factor, not a hard rule. */
export function leaveLabel(
  weekendFriendly: boolean,
  leaveDaysNeeded: number,
): string {
  if (weekendFriendly) return "週末出發 · 免請假";
  if (leaveDaysNeeded <= 0) return "免請假";
  if (leaveDaysNeeded === 1) return "只需請 1 天假";
  return `需請 ${leaveDaysNeeded} 天假`;
}

export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

/** ISO timestamp -> "2026/06/12 09:30" (Asia/Taipei). */
export function checkedAtLabel(iso: string): string {
  const d = new Date(iso);
  const t = new Date(d.getTime() + 8 * 3600 * 1000); // to UTC+8
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(
    t.getUTCDate(),
  )} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}
