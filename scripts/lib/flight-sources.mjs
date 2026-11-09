// 共用的票價資料源模組（Phase 1）。
// 把實測驗證過的呼叫/解析邏輯集中在這裡，給 fetch-daily 與 probe 重用。
// 只做「讀」——查詢票價、正規化成統一的 offer 形狀，不下單、不寫外部。
//
// 統一 offer 形狀：
//   { price:number|null, priceRaw:string|null, currency, airline,
//     stops:number, direct:boolean, departAt, arriveAt, flightNumbers:[] }

import { existsSync, readFileSync } from "node:fs";

// ---- .env.local 載入（本機用；GitHub Actions 由 secrets 直接給 env） ----
// 只在 env 未設時才從檔案補，所以 Actions 的 env 一律優先。
export function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

// 價格字串 → 數字（"$373" / "NT$11,900" → 373 / 11900）。
export function parsePrice(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 指數退避：1.5s, 3s, 6s, 12s…（上限 15s），給上游喘息時間。
const backoff = (attempt) => Math.min(1500 * 2 ** (attempt - 1), 15000);

// ---------- TalorData（Google Flights SERP）----------
// 即時爬取，會間歇性失敗（code 300 "error, not search"，不計費）→ 重試。
// code 0 / 200 = 成功（計費）；401/400 = 確定性錯誤，不重試。
export async function fetchTalor({
  origin,
  dest,
  outbound,
  ret,
  currency = "TWD",
  token = process.env.TALOR_TOKEN,
  retry = Number(process.env.TALOR_RETRY || 7),
}) {
  if (!token) return { ok: false, source: "talordata", error: "no token" };
  const body = new URLSearchParams({
    engine: "google_flights",
    departure_id: origin,
    arrival_id: dest,
    outbound_date: outbound,
    return_date: ret,
    currency: currency.toUpperCase(),
    type: "1",
    json: "1",
  });

  let lastErr = "unknown";
  for (let attempt = 1; attempt <= retry; attempt++) {
    let json;
    try {
      const res = await fetch("https://serpapi.talordata.net/serp/v1/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        lastErr = `HTTP ${res.status}`;
        await sleep(backoff(attempt));
        continue;
      }
    } catch (e) {
      lastErr = e.message;
      await sleep(backoff(attempt));
      continue;
    }

    const okCode = json.code === 0 || json.code === 200 || json.code === undefined;
    if (okCode) {
      const payload =
        json.data && typeof json.data === "object" ? json.data : json;
      const groups = [
        ...(Array.isArray(payload.best_flights) ? payload.best_flights : []),
        ...(Array.isArray(payload.other_departing_flights)
          ? payload.other_departing_flights
          : []),
        ...(Array.isArray(payload.other_flights) ? payload.other_flights : []),
      ];
      const offers = groups.map((g) => normalizeTalorGroup(g, currency));
      return {
        ok: true,
        source: "talordata",
        currency: detectCurrency(groups) || currency.toUpperCase(),
        offers,
        attempts: attempt,
      };
    }

    const msg = typeof json.data === "string" ? json.data : `code ${json.code}`;
    lastErr = `code ${json.code}: ${msg}`;
    if (json.code === 401 || json.code === 403 || json.code === 400) {
      return { ok: false, source: "talordata", error: lastErr, attempts: attempt };
    }
    if (attempt < retry) await sleep(backoff(attempt));
  }
  return { ok: false, source: "talordata", error: `${lastErr}（重試 ${retry} 次）`, attempts: retry };
}

function normalizeTalorGroup(g, currency) {
  const segs = Array.isArray(g.flight) ? g.flight : [];
  const first = segs[0] || {};
  const last = segs[segs.length - 1] || {};
  return {
    price: parsePrice(g.price),
    priceRaw: typeof g.price === "string" ? g.price : null,
    currency: /^\s*\$/.test(g.price || "") ? "USD?" : currency.toUpperCase(),
    airline: segs.map((s) => s.airline).filter(Boolean).join(" / ") || null,
    stops: Math.max(0, segs.length - 1),
    direct: segs.length === 1,
    departAt: first.departure_airport?.time ?? null,
    arriveAt: last.arrival_airport?.time ?? null,
    flightNumbers: segs.map((s) => s.flight_number).filter(Boolean),
  };
}

// 價格字串若以 $ 開頭、且非 NT$，很可能回成 USD（實測 TalorData 會這樣）。
function detectCurrency(groups) {
  const p = groups.find((g) => typeof g.price === "string")?.price || "";
  if (/^\s*NT\$/.test(p)) return "TWD";
  if (/^\s*\$/.test(p)) return "USD?";
  return null;
}

// ---------- Travelpayouts（Aviasales Data API）----------
// 快取型、免費。prices_for_dates 回某月快取中最便宜的票。
export async function fetchTravelpayouts({
  origin,
  dest,
  month, // YYYY-MM
  currency = "twd",
  token = process.env.TP_TOKEN,
  limit = 100,
}) {
  if (!token) return { ok: false, source: "travelpayouts", error: "no token" };
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", dest);
  url.searchParams.set("departure_at", month);
  url.searchParams.set("currency", currency.toLowerCase());
  url.searchParams.set("one_way", "false");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("token", token);

  try {
    const res = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) return { ok: false, source: "travelpayouts", error: `HTTP ${res.status}` };
    if (json.success === false)
      return { ok: false, source: "travelpayouts", error: json.error || "api error" };
    const data = Array.isArray(json.data) ? json.data : [];
    const offers = data.map((d) => ({
      price: typeof d.price === "number" ? d.price : parsePrice(d.price),
      priceRaw: null,
      currency: (json.currency || currency).toUpperCase(),
      airline: d.airline ?? null,
      stops: d.transfers ?? null,
      direct: d.transfers === 0,
      departAt: d.departure_at ?? null,
      arriveAt: d.return_at ?? null,
      flightNumbers: d.flight_number ? [String(d.flight_number)] : [],
    }));
    return {
      ok: true,
      source: "travelpayouts",
      currency: (json.currency || currency).toUpperCase(),
      offers,
    };
  } catch (e) {
    return { ok: false, source: "travelpayouts", error: e.message };
  }
}

// 從一組 offers 取最便宜（有數字價格的）。
export function cheapest(offers) {
  const priced = offers.filter((o) => typeof o.price === "number" && o.price > 0);
  if (!priced.length) return null;
  return priced.reduce((a, b) => (b.price < a.price ? b : a));
}
