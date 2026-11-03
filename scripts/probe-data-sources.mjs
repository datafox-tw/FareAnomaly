#!/usr/bin/env node
// Phase 1 資料源實測腳本 — 比較 Travelpayouts (Aviasales) Data API 與
// TalorData (Google Flights SERP) 對「台灣出發」路線的覆蓋、價格與新鮮度。
//
// 詳見 docs/phase1-data-source-research.md §六 step 1。
// 這支腳本只做「讀」—— 不會下單、不會寫任何東西到外部。
//
// 用法：
//   TP_TOKEN=xxx TALOR_TOKEN=yyy node scripts/probe-data-sources.mjs
//   （只給其中一個 token 也行，另一個會自動略過）
//
// 可選環境變數：
//   PROBE_CURRENCY  預設 twd
//   PROBE_LEAD_DAYS 出發日距今天數，預設 60
//   PROBE_TRIP_LEN  旅程天數（回程 = 出發 + 這個），預設 7
//   PROBE_DUMP      設為 1 時，把每個原始 JSON 回應存到 scripts/probe-output/
//
// Node 18+（內建 fetch）。本專案為 Node v24，直接 `node` 執行即可。

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 讀專案根目錄的 .env.local / .env（已被 .gitignore 忽略），把 token 載進 env。
// 這樣金鑰只存在檔案裡，不必寫在指令或對話中。環境變數優先於檔案。
function loadEnvFile(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(join(__dirname, "..", ".env.local"));
loadEnvFile(join(__dirname, "..", ".env"));

const TP_TOKEN = process.env.TP_TOKEN?.trim();
const TALOR_TOKEN = process.env.TALOR_TOKEN?.trim();
const CURRENCY = (process.env.PROBE_CURRENCY || "twd").toLowerCase();
const LEAD_DAYS = Number(process.env.PROBE_LEAD_DAYS || 60);
const TRIP_LEN = Number(process.env.PROBE_TRIP_LEN || 7);
const DUMP = process.env.PROBE_DUMP === "1";
const DUMP_DIR = join(__dirname, "probe-output");
// 省額度用：PROBE_PROVIDER=tp|talor|both（預設 both）；PROBE_MAX=N 只跑前 N 條路線（0=全部）。
const ONLY = (process.env.PROBE_PROVIDER || "both").toLowerCase();
const MAX = Number(process.env.PROBE_MAX || 0);
const useTP = (ONLY === "both" || ONLY === "tp") && Boolean(TP_TOKEN);
const useTalor = (ONLY === "both" || ONLY === "talor") && Boolean(TALOR_TOKEN);
// TalorData 的 google_flights 是即時爬取、會間歇性失敗（code 300 "error, not search"）。
// 這類失敗不計費，所以遇到就重試，直到成功（code 0，計費）或用完次數。
const TALOR_RETRY = Number(process.env.PROBE_RETRY || 4);

// 代表性路線：熱門（應該要有料）vs 冷門/長途（最可能露餡）。
// 刻意保持小量以節省免費額度。
const ROUTES = [
  { origin: "TPE", dest: "NRT", label: "東京（熱門短途）", tier: "hot" },
  { origin: "TPE", dest: "ICN", label: "首爾（熱門短途）", tier: "hot" },
  { origin: "TPE", dest: "HKG", label: "香港（熱門短途）", tier: "hot" },
  { origin: "KHH", dest: "NRT", label: "高雄→東京（次要出發地）", tier: "hot" },
  { origin: "TPE", dest: "BKK", label: "曼谷（中距）", tier: "mid" },
  { origin: "TPE", dest: "LHR", label: "倫敦（冷門長途）", tier: "cold" },
  { origin: "TPE", dest: "LAX", label: "洛杉磯（冷門長途）", tier: "cold" },
];

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const TODAY = new Date();
const OUTBOUND = addDays(TODAY, LEAD_DAYS);
const RETURN = addDays(OUTBOUND, TRIP_LEN);
const OUTBOUND_DATE = fmtDate(OUTBOUND); // YYYY-MM-DD
const RETURN_DATE = fmtDate(RETURN);
const DEPART_MONTH = OUTBOUND_DATE.slice(0, 7); // YYYY-MM (Travelpayouts 用)

function hoursAgo(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

// 深找：回傳物件中第一個名為 key 的屬性值（廣度優先）。
function deepFind(obj, key, depth = 6) {
  if (!obj || typeof obj !== "object" || depth < 0) return null;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const r = deepFind(v, key, depth - 1);
    if (r != null) return r;
  }
  return null;
}

// 深找：把物件裡任何 best_flights / other_flights / flights 陣列湊起來。
function deepFindFlights(obj, depth = 6) {
  if (!obj || typeof obj !== "object" || depth < 0) return [];
  let out = [];
  for (const k of ["best_flights", "other_departing_flights", "other_flights"]) {
    if (Array.isArray(obj[k])) out = out.concat(obj[k]);
  }
  if (out.length) return out;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const r = deepFindFlights(v, depth - 1);
      if (r.length) return r;
    }
  }
  return [];
}

async function dump(name, obj) {
  if (!DUMP) return;
  await mkdir(DUMP_DIR, { recursive: true });
  await writeFile(join(DUMP_DIR, name + ".json"), JSON.stringify(obj, null, 2));
}

// ---------- Travelpayouts (Aviasales) Data API ----------
// GET /aviasales/v3/prices_for_dates — 快取中該月找到的最便宜票。
async function probeTravelpayouts(route) {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", route.origin);
  url.searchParams.set("destination", route.dest);
  url.searchParams.set("departure_at", DEPART_MONTH);
  url.searchParams.set("currency", CURRENCY);
  url.searchParams.set("one_way", "false");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "100");
  url.searchParams.set("token", TP_TOKEN);

  const res = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
  const json = await res.json().catch(() => null);
  await dump(`tp_${route.origin}-${route.dest}`, json);

  if (!res.ok || !json) {
    return { ok: false, note: `HTTP ${res.status}` };
  }
  if (json.success === false) {
    return { ok: false, note: `API error: ${json.error || "unknown"}` };
  }
  const data = Array.isArray(json.data) ? json.data : [];
  const prices = data.map((d) => d.price).filter((p) => typeof p === "number");
  const freshness = data
    .map((d) => hoursAgo(d.found_at))
    .filter((h) => h != null);
  return {
    ok: true,
    count: data.length,
    minPrice: prices.length ? Math.min(...prices) : null,
    freshestHrs: freshness.length ? Math.min(...freshness) : null,
    stalestHrs: freshness.length ? Math.max(...freshness) : null,
  };
}

// price 是字串，如 "$373" / "NT$11,900"：去符號逗號轉數字。
function parsePrice(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// 把一份 TalorData google_flights 回應整理成摘要（純函式，可離線驗證）。
// 真實結構：data.best_flights[] + data.other_departing_flights[]，
// 每筆 group 有 flight[]（航段陣列）、price（字串）、type、carbon_emissions。
export function summarizeTalor(json) {
  const payload =
    json && json.data && typeof json.data === "object" ? json.data : json || {};
  const groups = [
    ...(Array.isArray(payload.best_flights) ? payload.best_flights : []),
    ...(Array.isArray(payload.other_departing_flights)
      ? payload.other_departing_flights
      : []),
    ...(Array.isArray(payload.other_flights) ? payload.other_flights : []),
  ];
  const all = groups.length ? groups : deepFindFlights(payload);
  const priced = all.map((g) => parsePrice(g?.price)).filter((p) => p != null);
  const rawPrice = all.find((g) => typeof g?.price === "string")?.price ?? null;
  const directCount = all.filter(
    (g) => Array.isArray(g.flight) && g.flight.length === 1,
  ).length;
  const insights = payload.price_insights || deepFind(payload, "price_insights");
  return {
    count: all.length,
    minPrice: priced.length ? Math.min(...priced) : null,
    rawPrice, // 保留原始字串，才看得出幣別（例：$ = 可能回成 USD）
    directCount,
    hasPriceInsights: Boolean(insights),
    lowestInsight: insights?.lowest_price ?? null,
    priceLevel: insights?.price_level ?? null,
    cacheStatus: payload.cache_status ?? null,
    sampleKeys: all[0] ? Object.keys(all[0]).join(",") : null,
  };
}

// ---------- TalorData (Google Flights SERP) ----------
// POST /serp/v1/request — engine=google_flights，SerpApi 相容 schema。
async function probeTalor(route) {
  const body = new URLSearchParams({
    engine: "google_flights",
    departure_id: route.origin,
    arrival_id: route.dest,
    outbound_date: OUTBOUND_DATE,
    return_date: RETURN_DATE,
    currency: CURRENCY.toUpperCase(),
    gl: "tw", // 嘗試鎖台灣 locale（先前回成 US/USD）
    hl: "zh-TW",
    type: "1", // 1 = 來回
    json: "1",
  });

  // TalorData 的 HTTP 幾乎都回 200，真正狀態在 body 的 `code`：
  //   code 0 / 200 = 成功（計費）；其他 = 失敗。
  //   code 300 "error, not search" = 即時爬取暫時沒抓到（不計費）→ 重試。
  //   code 401/400 = 認證或參數錯誤（確定性）→ 不重試。
  let lastNote = "unknown";
  for (let attempt = 1; attempt <= TALOR_RETRY; attempt++) {
    const res = await fetch("https://serpapi.talordata.net/serp/v1/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TALOR_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = await res.json().catch(() => null);
    await dump(`talor_${route.origin}-${route.dest}_try${attempt}`, json);

    if (!res.ok || !json) {
      lastNote = `HTTP ${res.status}`;
      continue; // 網路層問題，重試
    }

    const okCode =
      json.code === 0 || json.code === 200 || json.code === undefined;
    if (okCode) {
      const s = summarizeTalor(json);
      const note =
        s.count === 0
          ? `payload keys: ${Object.keys(json.data || json).join(", ") || "(空)"}（用 PROBE_DUMP=1 看原始回應）`
          : attempt > 1
            ? `第 ${attempt} 次才成功`
            : undefined;
      return { ok: true, attempts: attempt, ...s, note };
    }

    const msg = typeof json.data === "string" ? json.data : `code ${json.code}`;
    lastNote = `code ${json.code}: ${msg}`;
    // 確定性錯誤（認證/參數）不重試。
    if (json.code === 401 || json.code === 403 || json.code === 400) {
      return { ok: false, note: lastNote };
    }
    // 其餘（含 300 "error, not search"）稍等後重試。
    if (attempt < TALOR_RETRY) await new Promise((r) => setTimeout(r, 1500));
  }
  return { ok: false, note: `${lastNote}（重試 ${TALOR_RETRY} 次仍失敗）` };
}

function fmtMoney(v) {
  return v == null ? "—" : `${CURRENCY.toUpperCase()} ${v.toLocaleString("en-US")}`;
}
function fmtHrs(h) {
  return h == null ? "—" : `${h.toFixed(1)}h`;
}

// 離線模式：PROBE_PARSE_FILE=path/to.json 讀本地 TalorData 回應跑 parse，
// 不連網、不花額度，用來驗證解析是否正確。
async function parseFileMode(path) {
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);
  const s = summarizeTalor(json);
  console.log(`離線解析：${path}`);
  console.log(`  筆數：${s.count}`);
  console.log(`  最低價：${s.minPrice ?? "—"}（原始 ${s.rawPrice ?? "—"}）`);
  console.log(`  直飛筆數：${s.directCount}`);
  console.log(`  cache_status：${s.cacheStatus}`);
  console.log(`  price_insights：${s.hasPriceInsights ? "有" : "無"}`);
  console.log(`  單筆欄位：${s.sampleKeys}`);
}

async function run() {
  const parseFile = process.env.PROBE_PARSE_FILE;
  if (parseFile) return parseFileMode(parseFile);

  console.log("=".repeat(72));
  console.log("FareAnomaly 資料源實測 — 台灣出發路線覆蓋比較");
  console.log(`今天：${fmtDate(TODAY)} · 出發：${OUTBOUND_DATE} · 回程：${RETURN_DATE} · 幣別：${CURRENCY.toUpperCase()}`);
  console.log(
    `Travelpayouts：${useTP ? "✓ 跑" : "✗ 略過"}` +
      ` · TalorData：${useTalor ? "✓ 跑" : "✗ 略過"}` +
      (MAX > 0 ? ` · 只跑前 ${MAX} 條路線` : ""),
  );
  if (DUMP) console.log(`原始回應將存到：${DUMP_DIR}/`);
  console.log("=".repeat(72));

  if (!useTP && !useTalor) {
    console.error(
      "\n沒有可跑的來源。請至少設一個 token（並視需要用 PROBE_PROVIDER 選擇）：\n" +
        "  TP_TOKEN=... （Travelpayouts，免費 affiliate token）\n" +
        "  TALOR_TOKEN=... （TalorData，註冊後申請免費試用）\n" +
        "省額度：PROBE_PROVIDER=talor PROBE_MAX=1 PROBE_DUMP=1 只打 1 次並存原始回應。\n",
    );
    process.exit(1);
  }

  const summary = { tp: { hit: 0, n: 0 }, talor: { hit: 0, n: 0 } };
  const routes = MAX > 0 ? ROUTES.slice(0, MAX) : ROUTES;

  for (const route of routes) {
    console.log(`\n── ${route.origin}→${route.dest}  ${route.label}  [${route.tier}]`);

    if (useTP) {
      summary.tp.n++;
      try {
        const r = await probeTravelpayouts(route);
        if (!r.ok) {
          console.log(`   Travelpayouts: ⚠️  ${r.note}`);
        } else {
          if (r.count > 0) summary.tp.hit++;
          console.log(
            `   Travelpayouts: ${r.count > 0 ? "✅" : "⬜"} ${r.count} 筆` +
              ` · 最低 ${fmtMoney(r.minPrice)}` +
              ` · 新鮮度 ${fmtHrs(r.freshestHrs)}~${fmtHrs(r.stalestHrs)}`,
          );
        }
      } catch (e) {
        console.log(`   Travelpayouts: ❌ ${e.message}`);
      }
    }

    if (useTalor) {
      summary.talor.n++;
      try {
        const r = await probeTalor(route);
        if (!r.ok) {
          console.log(`   TalorData:     ⚠️  ${r.note}`);
        } else {
          if (r.count > 0) summary.talor.hit++;
          const ins = r.hasPriceInsights
            ? ` · price_insights✓（低價 ${r.lowestInsight}, level=${r.priceLevel}）`
            : "";
          const tries = r.attempts > 1 ? ` · 試 ${r.attempts} 次` : "";
          console.log(
            `   TalorData:     ${r.count > 0 ? "✅" : "⬜"} ${r.count} 筆` +
              ` · 最低 ${r.minPrice ?? "—"}（原始 ${r.rawPrice ?? "—"}）` +
              ` · 直飛 ${r.directCount}${ins}${tries}`,
          );
          if (r.note) console.log(`                  ↳ ${r.note}`);
        }
      } catch (e) {
        console.log(`   TalorData:     ❌ ${e.message}`);
      }
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("小結（命中 = 至少回傳 1 筆）");
  if (useTP)
    console.log(`  Travelpayouts：${summary.tp.hit}/${summary.tp.n} 條路線命中`);
  if (useTalor)
    console.log(`  TalorData：    ${summary.talor.hit}/${summary.talor.n} 條路線命中`);
  console.log("=".repeat(72));
  console.log(
    "判讀：熱門線兩家都該命中；重點看冷門/長途線誰有料、價格是否合理、Travelpayouts 的新鮮度夠不夠新。",
  );
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
