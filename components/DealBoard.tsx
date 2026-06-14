"use client";

import { useMemo, useState } from "react";
import type { Deal } from "@/lib/deals";
import { ORIGINS, ORIGIN_LABEL, REGIONS, type Region } from "@/lib/airports";
import { ntd } from "@/lib/format";
import DealCard from "./DealCard";

type TripBucket = "2-4" | "5-8" | "9-14";
type SortKey = "score" | "z" | "price" | "savings" | "soonest";

const TRIP_BUCKETS: { key: TripBucket; label: string; min: number; max: number }[] =
  [
    { key: "2-4", label: "2–4 晚", min: 2, max: 4 },
    { key: "5-8", label: "5–8 晚", min: 5, max: 8 },
    { key: "9-14", label: "9–14 晚", min: 9, max: 14 },
  ];

const DEFAULTS = {
  origin: "ALL" as "ALL" | (typeof ORIGINS)[number],
  regions: [] as Region[],
  buckets: [] as TripBucket[],
  dateStart: "",
  dateEnd: "",
  maxPrice: 35000,
  minScore: 0,
  directOnly: false,
  maxStops: 2,
  sort: "score" as SortKey,
};

export default function DealBoard({ deals }: { deals: Deal[] }) {
  const [origin, setOrigin] = useState(DEFAULTS.origin);
  const [regions, setRegions] = useState<Region[]>(DEFAULTS.regions);
  const [buckets, setBuckets] = useState<TripBucket[]>(DEFAULTS.buckets);
  const [dateStart, setDateStart] = useState(DEFAULTS.dateStart);
  const [dateEnd, setDateEnd] = useState(DEFAULTS.dateEnd);
  const [maxPrice, setMaxPrice] = useState(DEFAULTS.maxPrice);
  const [minScore, setMinScore] = useState(DEFAULTS.minScore);
  const [directOnly, setDirectOnly] = useState(DEFAULTS.directOnly);
  const [maxStops, setMaxStops] = useState(DEFAULTS.maxStops);
  const [sort, setSort] = useState<SortKey>(DEFAULTS.sort);

  function toggleRegion(r: Region) {
    setRegions((cur) =>
      cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r],
    );
  }
  function toggleBucket(b: TripBucket) {
    setBuckets((cur) =>
      cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b],
    );
  }
  function reset() {
    setOrigin(DEFAULTS.origin);
    setRegions([]);
    setBuckets([]);
    setDateStart("");
    setDateEnd("");
    setMaxPrice(DEFAULTS.maxPrice);
    setMinScore(0);
    setDirectOnly(false);
    setMaxStops(2);
    setSort("score");
  }

  const filtered = useMemo(() => {
    const inBucket = (len: number) =>
      buckets.length === 0 ||
      buckets.some((b) => {
        const def = TRIP_BUCKETS.find((x) => x.key === b)!;
        return len >= def.min && len <= def.max;
      });

    const list = deals.filter((d) => {
      if (origin !== "ALL" && d.origin !== origin) return false;
      if (regions.length && !regions.includes(d.region)) return false;
      if (!inBucket(d.tripLength)) return false;
      if (dateStart && d.departureDate < dateStart) return false;
      if (dateEnd && d.departureDate > dateEnd) return false;
      if (d.price > maxPrice) return false;
      if (d.score.final < minScore) return false;
      if (directOnly && !d.direct) return false;
      if (d.stops > maxStops) return false;
      return true;
    });

    const sorted = [...list];
    switch (sort) {
      case "z":
        sorted.sort((a, b) => a.z - b.z);
        break;
      case "price":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "savings":
        sorted.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
        break;
      case "soonest":
        sorted.sort((a, b) =>
          a.departureDate.localeCompare(b.departureDate),
        );
        break;
      default:
        sorted.sort((a, b) => b.score.final - a.score.final);
    }
    return sorted;
  }, [
    deals,
    origin,
    regions,
    buckets,
    dateStart,
    dateEnd,
    maxPrice,
    minScore,
    directOnly,
    maxStops,
    sort,
  ]);

  const godCount = filtered.filter((d) => d.label === "神票").length;

  return (
    <div className="container layout">
      <aside className="filters">
        <h3>篩選條件</h3>
        <div className="sub">調整後結果即時更新</div>

        <div className="field">
          <label>出發地</label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as typeof origin)}
          >
            <option value="ALL">全部出發地</option>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>目的區域</label>
          <div className="chips">
            {REGIONS.map((r) => (
              <span
                key={r}
                className={`chip ${regions.includes(r) ? "active" : ""}`}
                onClick={() => toggleRegion(r)}
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>出發日期範圍</label>
          <input
            type="date"
            value={dateStart}
            min="2026-06-12"
            max="2026-12-31"
            onChange={(e) => setDateStart(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <input
            type="date"
            value={dateEnd}
            min="2026-06-12"
            max="2026-12-31"
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>

        <div className="field">
          <label>旅程長度</label>
          <div className="chips">
            {TRIP_BUCKETS.map((b) => (
              <span
                key={b.key}
                className={`chip ${buckets.includes(b.key) ? "active" : ""}`}
                onClick={() => toggleBucket(b.key)}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            最高票價 <span className="range-val">{ntd(maxPrice)}</span>
          </label>
          <input
            type="range"
            min={3000}
            max={35000}
            step={500}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>
            最低 Deal Score <span className="range-val">{minScore}</span>
          </label>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label className="toggle">
            <input
              type="checkbox"
              checked={directOnly}
              onChange={(e) => setDirectOnly(e.target.checked)}
            />
            只看直飛
          </label>
        </div>

        <div className="field">
          <label>最多轉機次數</label>
          <select
            value={maxStops}
            disabled={directOnly}
            onChange={(e) => setMaxStops(Number(e.target.value))}
          >
            <option value={0}>0 次（直飛）</option>
            <option value={1}>最多 1 次</option>
            <option value={2}>最多 2 次</option>
          </select>
        </div>

        <button className="reset" onClick={reset}>
          重設篩選
        </button>
      </aside>

      <main>
        <div className="results-head">
          <div>
            <h2>今日異常便宜榜</h2>
            <span className="count">
              {filtered.length} 張符合條件
              {godCount > 0 && ` · 其中 ${godCount} 張神票`}
            </span>
          </div>
          <div className="sortbar">
            排序
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="score">Deal Score</option>
              <option value="z">最異常 (z-score)</option>
              <option value="price">最低價</option>
              <option value="savings">省最多</option>
              <option value="soonest">最快出發</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState regions={regions} />
        ) : (
          <div className="deal-grid">
            {filtered.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ regions }: { regions: Region[] }) {
  const where =
    regions.length === 1 ? `${regions[0]}區` : "目前的篩選條件下";
  return (
    <div className="empty">
      <div className="fox">🦊💤</div>
      <h3>今天{where}沒有真正異常便宜的票</h3>
      <p>
        現在看到的低價大多只是正常淡季價格，不建議硬買。放寬票價上限或日期範圍，
        或設定一個票價雷達，等真正的神票出現時通知你。
      </p>
    </div>
  );
}
