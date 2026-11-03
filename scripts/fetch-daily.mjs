#!/usr/bin/env node
// 每日票價快照抓取（Phase 1，第一階：只抓 TPE 出發）。
// 由 GitHub Actions 每天排程執行，把當天快照存成 data/snapshots/<date>.json，
// 累積成自己的歷史，之後給 z-score 異常偵測當基準用。
//
// 本機測試：
//   node scripts/fetch-daily.mjs                 # 讀 .env.local 的 token
//   LEAD_DAYS=30 node scripts/fetch-daily.mjs     # 只抓 30 天後這個 window（省額度）
//
// 環境變數：
//   TP_TOKEN / TALOR_TOKEN   資料源 token（Actions 走 secrets）
//   LEAD_DAYS   出發距今天數清單，逗號分隔，預設 "30,60"
//   TRIP_LEN    旅程天數（回程=出發+此值），預設 7
//   CURRENCY    要求幣別，預設 twd（註：TalorData 實測仍回 USD，見研究文件）
//   ONLY        talor | tp | both（預設 both）

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  loadEnvFile,
  fetchTalor,
  fetchTravelpayouts,
  cheapest,
} from "./lib/flight-sources.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, ".env"));

const LEAD_DAYS = (process.env.LEAD_DAYS || "30,60")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const TRIP_LEN = Number(process.env.TRIP_LEN || 7);
const CURRENCY = (process.env.CURRENCY || "twd").toLowerCase();
const ONLY = (process.env.ONLY || "both").toLowerCase();
const useTalor = (ONLY === "both" || ONLY === "talor") && Boolean(process.env.TALOR_TOKEN);
const useTP = (ONLY === "both" || ONLY === "tp") && Boolean(process.env.TP_TOKEN);

const ORIGIN = "TPE";
// 第一階目的地（12 條，對應 lib/airports.ts 的代碼）。
const DESTS = [
  { code: "NRT", city: "東京成田", region: "日本" },
  { code: "ICN", city: "首爾仁川", region: "韓國" },
  { code: "KIX", city: "大阪關西", region: "日本" },
  { code: "OKA", city: "沖繩那霸", region: "日本" },
  { code: "BKK", city: "曼谷", region: "東南亞" },
  { code: "SIN", city: "新加坡", region: "東南亞" },
  { code: "CTS", city: "札幌新千歲", region: "日本" },
  { code: "FUK", city: "福岡", region: "日本" },
  { code: "NGO", city: "名古屋", region: "日本" },
  { code: "CJU", city: "濟州", region: "韓國" },
  { code: "LHR", city: "倫敦", region: "歐洲" },
  { code: "LAX", city: "洛杉磯", region: "北美" },
];

const pad = (n) => String(n).padStart(2, "0");
function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// 把一組 offers 壓成精簡摘要（存最便宜 + 前 5 筆，控制檔案大小）。
function summarize(result) {
  if (!result.ok) return { ok: false, error: result.error, attempts: result.attempts };
  const c = cheapest(result.offers);
  const top = [...result.offers]
    .filter((o) => typeof o.price === "number")
    .sort((a, b) => a.price - b.price)
    .slice(0, 5)
    .map((o) => ({
      price: o.price,
      priceRaw: o.priceRaw,
      airline: o.airline,
      direct: o.direct,
      stops: o.stops,
      departAt: o.departAt,
    }));
  return {
    ok: true,
    currency: result.currency,
    offerCount: result.offers.length,
    minPrice: c ? c.price : null,
    cheapest: c
      ? { price: c.price, airline: c.airline, direct: c.direct, stops: c.stops }
      : null,
    top,
    attempts: result.attempts,
  };
}

async function run() {
  const now = new Date();
  const capturedAt = now.toISOString();
  const captureDate = ymd(now);

  console.log(`FareAnomaly 每日抓取 · ${captureDate}`);
  console.log(
    `出發地 ${ORIGIN} · 目的地 ${DESTS.length} 條 · lead ${LEAD_DAYS.join("/")} 天 · 旅程 ${TRIP_LEN} 晚`,
  );
  console.log(
    `來源：TalorData ${useTalor ? "✓" : "✗"} · Travelpayouts ${useTP ? "✓" : "✗"}`,
  );
  if (!useTalor && !useTP) {
    console.error("沒有可用 token（TP_TOKEN / TALOR_TOKEN）。");
    process.exit(1);
  }

  const windows = LEAD_DAYS.map((lead) => {
    const outbound = addDays(now, lead);
    const ret = addDays(outbound, TRIP_LEN);
    return { leadDays: lead, outboundDate: ymd(outbound), returnDate: ymd(ret) };
  });

  const routes = [];
  let talorHit = 0;
  let tpHit = 0;

  for (const dest of DESTS) {
    const queries = [];
    for (const w of windows) {
      const sources = {};

      if (useTalor) {
        const r = await fetchTalor({
          origin: ORIGIN,
          dest: dest.code,
          outbound: w.outboundDate,
          ret: w.returnDate,
          currency: CURRENCY,
        });
        sources.talordata = summarize(r);
        if (r.ok && r.offers.length) talorHit++;
      }
      if (useTP) {
        const r = await fetchTravelpayouts({
          origin: ORIGIN,
          dest: dest.code,
          month: w.outboundDate.slice(0, 7),
          currency: CURRENCY,
        });
        sources.travelpayouts = summarize(r);
        if (r.ok && r.offers.length) tpHit++;
      }

      queries.push({ ...w, sources });
    }
    routes.push({ destination: dest.code, city: dest.city, region: dest.region, queries });

    // 進度行（每條一行，方便看 Actions log）。
    const parts = [];
    const last = queries[0].sources;
    if (last.talordata)
      parts.push(`Talor ${last.talordata.ok ? `${last.talordata.offerCount}筆/最低${last.talordata.minPrice ?? "—"}` : "✗"}`);
    if (last.travelpayouts)
      parts.push(`TP ${last.travelpayouts.ok ? `${last.travelpayouts.offerCount}筆/最低${last.travelpayouts.minPrice ?? "—"}` : "✗"}`);
    console.log(`  ${ORIGIN}→${dest.code} ${dest.city}: ${parts.join(" · ")}`);
  }

  const snapshot = {
    capturedAt,
    captureDate,
    origin: ORIGIN,
    tripLength: TRIP_LEN,
    requestedCurrency: CURRENCY.toUpperCase(),
    note: "TalorData 價格實測回 USD；requestedCurrency 僅記錄請求值，實際幣別見各 source.currency。",
    routes,
  };

  const outDir = join(ROOT, "data", "snapshots");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `${captureDate}.json`);
  await writeFile(outFile, JSON.stringify(snapshot, null, 2));

  console.log(
    `\n完成：${routes.length} 條路線寫入 ${outFile}` +
      `（命中 Talor ${talorHit} / TP ${tpHit}，共 ${DESTS.length * windows.length} 次查詢/來源）`,
  );
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
