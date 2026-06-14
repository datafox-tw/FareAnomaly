// Deterministic fake deal generation for the Phase 0 prototype (PRD §14 Phase 0).
// No real API; reproducible so the UI is stable across renders.

import {
  AIRPORTS,
  AIRPORT_BY_CODE,
  ORIGINS,
  type Airport,
  type Origin,
  type Region,
} from "./airports";
import {
  cheaperThanPct,
  labelFromZ,
  scoreDeal,
  type DealLabel,
  type ScoreBreakdown,
} from "./scoring";

/** "Today" for the prototype — matches the product's current date. */
export const TODAY = new Date("2026-06-12T09:30:00+08:00");

export interface Deal {
  id: string;
  origin: Origin;
  destination: string;
  destCity: string;
  region: Region;
  departureDate: string; // YYYY-MM-DD
  returnDate: string;
  tripLength: number; // nights
  price: number; // NT$, round trip
  historicalMean: number;
  historicalMedian: number;
  historicalStd: number;
  sampleSize: number;
  estimatedSavings: number;
  z: number;
  percentileCheaper: number;
  stops: number;
  durationMinutes: number; // one-way
  airline: string;
  redEye: boolean;
  direct: boolean;
  label: DealLabel;
  score: ScoreBreakdown;
  weekendFriendly: boolean;
  leaveDaysNeeded: number;
  explanation: string;
  foxTake: string;
  source: string;
  bookingUrl: string;
  checkedAt: string; // ISO
  revalidated: boolean;
  stale: boolean;
}

// ---- seeded RNG (mulberry32) ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AIRLINES_SHORT = ["長榮航空", "中華航空", "星宇航空", "樂桃航空", "酷航", "台灣虎航", "韓亞航空"];
const AIRLINES_LONG = ["長榮航空", "中華航空", "星宇航空", "國泰航空", "新加坡航空", "芬蘭航空", "荷蘭皇家航空"];
const LCC = new Set(["樂桃航空", "酷航", "台灣虎航"]);

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function buildExplanation(z: number, pct: number, savings: number): string {
  const fmt = `NT$${savings.toLocaleString("en-US")}`;
  return `比過去 ${pct}% 的同類票都便宜，低於平常約 ${Math.abs(z).toFixed(1)} 個標準差，預估省下 ${fmt}。`;
}

function buildFoxTake(
  label: DealLabel,
  s: ScoreBreakdown,
  weekendFriendly: boolean,
  region: Region,
): string {
  if (label === "神票") {
    if (s.quality >= 80 && weekendFriendly)
      return "狐狸銳評：這張是真的神票，時間也漂亮，可以認真考慮。";
    if (s.quality < 60)
      return "狐狸銳評：價格是真的香，但航班品質普通，看你受不受得了。";
    return "狐狸銳評：價格非常罕見，值得點進去確認一下細節。";
  }
  if (label === "很便宜") {
    if (region === "歐洲" || region === "北美")
      return "狐狸銳評：長途票能到這個價算不錯，想衝可以開始查住宿了。";
    return "狐狸銳評：明顯低於平常，短途又順，值得認真看。";
  }
  if (label === "可考慮") {
    return "狐狸銳評：比平常便宜一些，但還沒到非搶不可，可以再等等。";
  }
  return "狐狸銳評：其實只是正常價格，不用硬買。";
}

export function generateDeals(): Deal[] {
  const deals: Deal[] = [];
  let seed = 20260612;

  for (const dest of AIRPORTS) {
    const isLong = dest.region === "北美" || dest.region === "歐洲";
    // Fewer deals for long-haul (sparse test routes, PRD §13).
    const count = isLong ? 1 : 2;

    for (let k = 0; k < count; k++) {
      const rng = mulberry32(seed++);
      const origin: Origin = pick(rng, [...ORIGINS]);

      // Historical baseline for this route (NT$).
      const median = Math.round(dest.baseFare * (0.96 + rng() * 0.12));
      const std = Math.round(median * (isLong ? 0.16 : 0.22));
      const mean = Math.round(median * 1.04);
      const sampleSize = 40 + Math.floor(rng() * 140);

      // Bias toward genuinely cheap fares (this is a deals board), but keep
      // a few ordinary ones so filters & the empty state are meaningful.
      const zRoll = rng();
      let z: number;
      if (zRoll < 0.32) z = -(2.0 + rng() * 1.3); // 神票
      else if (zRoll < 0.62) z = -(1.5 + rng() * 0.5); // 很便宜
      else if (zRoll < 0.85) z = -(1.0 + rng() * 0.5); // 可考慮
      else z = -(0.2 + rng() * 0.8); // 普通

      const price = Math.max(1500, Math.round(mean + z * std));
      const savings = Math.max(0, median - price);

      // Trip dates.
      const lead = 14 + Math.floor(rng() * 166); // 14..180 days out
      const departure = addDays(TODAY, lead);
      let tripLength: number;
      const tlRoll = rng();
      if (tlRoll < 0.4) tripLength = 2 + Math.floor(rng() * 3); // 2-4
      else if (tlRoll < 0.78) tripLength = 5 + Math.floor(rng() * 4); // 5-8
      else tripLength = 9 + Math.floor(rng() * 6); // 9-14
      const ret = addDays(departure, tripLength);

      // Flight characteristics.
      const stops = isLong
        ? rng() < 0.5
          ? 1
          : 0
        : rng() < 0.18
          ? 1
          : 0;
      const direct = stops === 0;
      const durationMultiplier = stops === 0 ? 1 : 1.7 + rng() * 0.6;
      const durationMinutes = Math.round(
        dest.baseDuration * durationMultiplier,
      );
      const airline = pick(rng, isLong ? AIRLINES_LONG : AIRLINES_SHORT);
      const lccNoBaggage = LCC.has(airline) && rng() < 0.6;
      const redEye = !isLong && rng() < 0.25;
      const remoteAirport = ["DMK", "MFM"].includes(dest.code) && rng() < 0.5;

      // Feasibility.
      const dow = departure.getDay(); // 5=Fri, 6=Sat
      const weekendFriendly =
        dest.weekendSuitable && tripLength <= 4 && (dow === 5 || dow === 6);
      const leaveDaysNeeded = weekendFriendly
        ? 0
        : Math.max(0, tripLength - 2 - (dow === 5 ? 1 : 0));

      const stale = rng() < 0.12;
      const revalidated = !stale && rng() < 0.55;

      const score = scoreDeal({
        z,
        price,
        stops,
        durationMinutes,
        baseDurationMinutes: dest.baseDuration,
        redEye,
        lccNoBaggage,
        remoteAirport,
        weekendFriendly,
        leaveDaysNeeded,
        stale,
      });

      const label = labelFromZ(z);
      const pct = cheaperThanPct(z);

      // checked_at within the last ~22h, deterministic.
      const checkedAt = new Date(
        TODAY.getTime() - Math.floor(rng() * 22 * 3600 * 1000),
      ).toISOString();

      deals.push({
        id: `${origin}-${dest.code}-${fmtDate(departure)}-${k}`,
        origin,
        destination: dest.code,
        destCity: dest.city,
        region: dest.region,
        departureDate: fmtDate(departure),
        returnDate: fmtDate(ret),
        tripLength,
        price,
        historicalMean: mean,
        historicalMedian: median,
        historicalStd: std,
        sampleSize,
        estimatedSavings: savings,
        z: Number(z.toFixed(2)),
        percentileCheaper: pct,
        stops,
        durationMinutes,
        airline,
        redEye,
        direct,
        label,
        score,
        weekendFriendly,
        leaveDaysNeeded,
        explanation: buildExplanation(z, pct, savings),
        foxTake: buildFoxTake(label, score, weekendFriendly, dest.region),
        source: pick(rng, ["Travelpayouts", "Skyscanner", "Amadeus"]),
        bookingUrl: `https://www.google.com/travel/flights?q=${origin}%20${dest.code}%20${fmtDate(departure)}`,
        checkedAt,
        revalidated,
        stale,
      });
    }
  }

  // Rank by final deal score (PRD §10.5).
  return deals.sort((a, b) => b.score.final - a.score.final);
}

export const DEALS: Deal[] = generateDeals();

export function dealById(id: string): Deal | undefined {
  return DEALS.find((d) => d.id === id);
}

export function airportOf(code: string): Airport | undefined {
  return AIRPORT_BY_CODE[code];
}
