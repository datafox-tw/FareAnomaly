// Ranking & scoring logic — PRD §10.
// Rule-based for Phase 0; no model training.

export type DealLabel = "神票" | "很便宜" | "可考慮" | "普通";

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/** z < -2 → 神票, etc. (PRD §10.1) */
export function labelFromZ(z: number): DealLabel {
  if (z < -2.0) return "神票";
  if (z < -1.5) return "很便宜";
  if (z < -1.0) return "可考慮";
  return "普通";
}

/** % of historical same-class fares this price beats. */
export function cheaperThanPct(z: number): number {
  return Math.round((1 - normalCdf(z)) * 100);
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface ScoreInputs {
  z: number;
  price: number;
  stops: number;
  durationMinutes: number;
  baseDurationMinutes: number; // typical non-stop one-way
  redEye: boolean;
  lccNoBaggage: boolean;
  remoteAirport: boolean;
  weekendFriendly: boolean; // metadata + dates support a no-leave weekend trip
  leaveDaysNeeded: number;
  stale: boolean; // price may already be expired
}

export interface ScoreBreakdown {
  anomaly: number;
  price: number;
  quality: number;
  feasibility: number;
  final: number;
  penalties: string[];
}

/** Reference upper bound for "absolute affordability" scoring, NT$. */
const PRICE_REFERENCE_MAX = 35000;

export function scoreDeal(i: ScoreInputs): ScoreBreakdown {
  // Anomaly: z=0 → 0, z<=-3 → 100.
  const anomaly = clamp((-i.z / 3) * 100);

  // Absolute price affordability.
  const price = clamp((1 - i.price / PRICE_REFERENCE_MAX) * 100);

  // Flight quality with penalties (PRD §10.4).
  const penalties: string[] = [];
  let quality = 100;
  if (i.stops > 0) {
    quality -= i.stops * 16;
    penalties.push(i.stops === 1 ? "需轉機 1 次" : `需轉機 ${i.stops} 次`);
  }
  const overshoot = i.durationMinutes - i.baseDurationMinutes * (i.stops + 1);
  if (overshoot > 120) {
    quality -= 14;
    penalties.push("總飛行時間偏長");
  }
  if (i.redEye) {
    quality -= 18;
    penalties.push("紅眼班機");
  }
  if (i.lccNoBaggage) {
    quality -= 10;
    penalties.push("廉航未含託運行李");
  }
  if (i.remoteAirport) {
    quality -= 8;
    penalties.push("抵達機場較偏遠");
  }
  if (i.stale) {
    quality -= 12;
    penalties.push("價格可能已過期");
  }
  quality = clamp(quality);

  // Trip feasibility (PRD §7.3 / §10).
  let feasibility = 60;
  if (i.weekendFriendly) feasibility += 25;
  feasibility -= i.leaveDaysNeeded * 8;
  feasibility = clamp(feasibility);

  // PRD §10.5 weighting.
  const final =
    0.45 * anomaly + 0.25 * price + 0.2 * quality + 0.1 * feasibility;

  return {
    anomaly: Math.round(anomaly),
    price: Math.round(price),
    quality: Math.round(quality),
    feasibility: Math.round(feasibility),
    final: Math.round(final),
    penalties,
  };
}
