# 🦊 FareAnomaly — 機票異常便宜雷達

> 不要問去哪裡，先看哪裡便宜到不合理。

**Phase 0 fake-data prototype** (PRD §14). A daily-updating dashboard that surfaces
statistically *abnormally cheap* round-trip flights from Taiwan (TPE/TSA/KHH), ranked by an
anomaly-driven Deal Score. No real fares yet — everything is deterministic demo data,
so the UI validates the product narrative without any API cost. (Fox mascot kept; named
FareAnomaly since the FlightFox name was taken.)

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

## What's here

| Page | Path | PRD ref |
| --- | --- | --- |
| Home + 今日異常便宜榜 + live filters | `/` | §7.1, §7.2, §11.1 |
| Deal detail (new score gauge + weighted breakdown, stats, trust) | `/deals/[id]` | §11.2, §11.4 |
| 票價雷達 alert setup (multi-channel) + saved radars | `/alerts` | §7.5, User Story 6 |
| Simple email login (mock magic-link) | `/login` | new |

### Recent decisions (from product owner)
- **Name:** FlightFox → **FareAnomaly** (fox mascot + 狐狸銳評 retained).
- **Origins:** TPE **and** TSA/KHH — Taiwan-wide.
- **Auth:** simple `email`-only mock magic-link (localStorage). Real magic-link + DB in Phase 3;
  intent is an email list of subscribers.
- **Notifications:** LINE (ideal) / Telegram (fast prototype via @BotFather) / Discord / Email — channel picker with per-channel setup notes.
- **Deal Score:** kept, with a **new UI** — circular gauge + a stacked bar where each segment's
  width *is* its weighted contribution to the final score.
- **Scoring factors:** hotel cost dropped; **請假天數 (leave days)** shown as a reference factor.

### Implemented from the PRD
- **Deal Score** = 0.45·Anomaly + 0.25·Price + 0.20·Quality + 0.10·Feasibility (§10.5),
  rule-based — `lib/scoring.ts`.
- **z-score → label** (神票 / 很便宜 / 可考慮 / 普通) and **percentile** ("比過去 96% 的票便宜"), §10.1–10.2.
- **Estimated savings** vs. historical median (§10.3) and **quality penalties** (§10.4:
  轉機、紅眼、廉航無行李、偏遠機場、價格過期).
- **Filters** (§7.2): 出發地 / 目的區域 / 出發日期範圍 / 旅程長度 / 最高票價 /
  最低 Deal Score / 只看直飛 / 最多轉機次數 — all client-side & instant.
- **Trust design** (§11.4): 最後檢查時間、資料來源、已重新驗證、價格變動提醒.
- **Empty state** (§11.3): honest "今天這區沒有真正異常便宜的票".
- **狐狸銳評**: natural-language take per deal.

### Data model (`lib/`)
- `airports.ts` — 30 destinations across 日本/韓國/東南亞/港澳/北美/歐洲 (§13) with metadata (§8.2).
- `deals.ts` — seeded RNG generates a reproducible deal pool; ranked by Deal Score.
- `scoring.ts` — z-score, normal-CDF percentile, weighted Deal Score.

## Not in scope (Phase 0)
Real fare APIs, persistence, auth, actual notifications. See PRD §14 Phase 1–3.
