# Phase 1 資料來源可行性研究 — FareAnomaly

> 研究日期：2026-11-03 · 問題：Phase 0 的假資料要換成真實票價，走「掃描 + 歷史基準 + 異常偵測」這條路可不可行？該用哪個 API？

## TL;DR

**這條路可行，但不是靠「一個 API 直接給我歷史價格」，而是靠「找一個便宜、可大量輪詢的快取價格源，自己每天存快照、累積出歷史基準」。**

- **✅ 已實測（2026-11-03，見 §四之二）：混合策略成立。** TalorData 命中 5/7（含 Travelpayouts 全 0 的長途倫敦/洛杉磯），Travelpayouts 命中 3/7（含 TalorData 當次抓失敗的高雄東京、曼谷）。兩家互補。
- **廣度主力：Google Flights 爬蟲 / SERP API（TalorData 實測）** — 直接抓 Google Flights，台灣路線（含長途）覆蓋好、資料新鮮、一次回十幾到三十幾筆；每次請求計費但單價低。**三個已知問題**：即時爬會間歇性失敗（要重試）、價格回成 USD（要換匯）、無價格歷史（自建）。**代價仍是法遵/ToS 風險**。
- **免費補充：Travelpayouts (Aviasales) Data API** — 免費 affiliate、額度大，但覆蓋 patchy（長途全空），當交叉驗證與補洞用。
- **Duffel**：留到未來「站內成交」再用，不適合當掃描源（理由見上次對話／下表）。
- **Amadeus Self-Service**：❌ 已於 **2026-07-17 正式關閉**，只剩 Enterprise（業務洽談），排除。
- **Kiwi Tequila**：❌ 2024 起轉為「只收策略夥伴」，新專案基本進不去，排除。

---

## 一、這個產品對資料源的根本需求

FareAnomaly 不是比價站，是**異常偵測雷達**。所以資料源的要求跟一般訂票 API 很不一樣：

| 需求 | 說明 | 一般訂票 API 能給嗎 |
| --- | --- | --- |
| **大量、廣掃** | 要同時盯 3 出發地 × 30+ 目的地 × 多個日期 | ❌ 訂票 API 計價綁成交，掃描會很貴 |
| **歷史/趨勢基準** | z-score 需要「這條線平常多少錢」 | ❌ 幾乎都只給當下報價 |
| **便宜到可天天跑** | 要每天刷新才能抓到神票 | ❌ 成交型 API 不行 |
| **即時精準報價** | 不需要——使用者是跳轉去訂，不在站內訂 | （不是重點） |

→ 結論：我們要的是**快取型/聚合型價格源**，不是**成交型 GDS/NDC API**。這個區分是整個 Phase 1 的核心。

---

## 二、候選比較

| 平台 | 存取門檻 | 費用（掃描場景） | 歷史/趨勢價 | 台灣出發覆蓋 | 判定 |
| --- | --- | --- | --- | --- | --- |
| **Travelpayouts Data API** | 免費 affiliate token | **免費**（有 rate limit） | 日曆、月矩陣、latest（近似趨勢） | ⚠️ 取決於 Aviasales 使用者搜尋量 | ✅ **首選（待實測）** |
| **Google Flights 爬蟲 / SERP API** | 註冊即用，有免費試用 | 每次請求計費，單價低（~$0.25–0.90/千次, SerpApi 較貴） | ❌ 無（但新鮮、可自存） | ✅ **優（Google Flights 直出）** | ✅ **強力候選（有法遵風險）** |
| **Duffel** | 免費註冊 | 搜尋免費額度 = 訂單數×1500；零訂單→每次 $0.005 | ❌ 無 | ✅ 真實 NDC | 🔸 留給站內成交 |
| **Amadeus Self-Service** | — | — | 曾有 Price Analysis（分位數） | — | ❌ 已關閉 (2026-07-17) |
| **Kiwi Tequila** | 僅策略夥伴 | — | ❌ | ✅ | ❌ 新專案進不去 |
| **Aviasales/TP Live Search API** | 需 50,000+ MAU | — | 即時 | ✅ | ❌ 門檻太高 |

---

## 三、各家細節

### ✅ Travelpayouts (Aviasales) Flights Data API — 首選

來源：Travelpayouts 官方 Help Center（已實際渲染讀取）。

**存取**
- 免費加入 affiliate，用 `X-Access-Token` header 或 `token` 參數帶 token。
- 任何有公開管道（blog/網站/社群）者皆可申請，無付費。

**資料性質（關鍵）**
- 資料來自 **Aviasales 使用者搜尋的快取**，**保存 7 天**，官方建議拿來生成靜態頁。
- 預設幣別 RUB（可用 `currency` 參數改）；價格附 `expires_at`，過期不建議用。
- **有「market」概念**：快取按市場區分，市場通常由出發地/語言決定。→ 台灣出發的資料密度取決於有多少人在對應市場的 Aviasales 站搜過 TPE/TSA/KHH 出發的票。

**可用端點（對我們有用的）**
- `v3/prices_for_dates` — 指定日期的最便宜票（近 48 小時使用者找到的）。
- `v3/get_latest_prices` — 可用 `period_type=year/month/day` 取某期間找到的票 → **最接近「歷史」的端點**。
- `v2/prices/month-matrix` — 整個月每天的價格（日曆）→ 很適合做「便宜日期」視覺。
- `v2/prices/nearest-places-matrix` — 鄰近機場替代路線。

**Rate limits（來自官方 rate-limit 文件，先前查到）**
- 日曆 / cheap 類：約 **300 req/min**；direct 約 180；monthly 約 60。對我們的掃描量綽綽有餘。

**為什麼適合**：免費 + 額度大 + 有日曆/latest 端點 → 可以**每天輪詢、把快照存進自己的 DB**，幾週後就有自建的歷史分布，z-score 就有基準了。商業模式是 affiliate 分潤，跟我們「跳轉訂票賺佣金」天然吻合。

### ✅ Google Flights 爬蟲 / SERP API（SerpApi、TalorData…）— 強力候選

這是一整類服務：把 Google Flights 的搜尋結果抓成結構化 JSON。標竿是 **SerpApi 的 `engine=google_flights`**，TalorData、HasData、SearchApi 等為同類（多為代理網路型供應商）。

**回傳欄位**：出發/到達機場、日期、航空公司、航班號、價格、幣別、轉機次數與機場、飛行時長、票價類型、預訂連結，以及 **`collected_at` 時間戳**（對自建價格歷史很關鍵）。

**為什麼是強力候選**
- **台灣覆蓋好**：資料來自 Google Flights，TPE/TSA/KHH 出發的熱門與冷門線（含歐美長途）都查得到 → **直接補上 Travelpayouts 那個「快取密度」的最大風險**。
- **新鮮**：依請求即時抓取、附時間戳；輪詢後自存即成歷史基準。
- **成本可接受**：按請求計費但單價低。
  - **TalorData**：免費試用 1,000 次；付費約 **$0.90/千次** 起，量大低至 **~$0.25/千次**；pay-per-successful-request。
  - **SerpApi**（較貴、文件最完整）：免費 250/月；Starter $25/千次 起，量大約 $9/千次；**來回票可能算 2 次搜尋**；只計成功請求。
  - 粗估我們的掃描量 ~21 萬次/月：TalorData 約 **$53–$189/月**；SerpApi 會貴很多（可能上千鎂）。→ 若走這條，用便宜的 SERP 供應商，別用 SerpApi 當主力。

**代價與風險（必須正視）**
- **法遵 / ToS**：抓取 Google Flights **違反 Google 服務條款**；且票價原始資料來自 ITA/航空公司，轉售爬取資料有法律曝險。玩原型沒差，但你說要「把產品做好」＝有使用者的正式商業產品，這點要先想清楚（或至少知道自己在冒什麼險）。
- **穩定性**：爬蟲會因 Google 版型改動而壞，依賴供應商維護；選「只計成功請求」的計費可降低失敗成本。
- **無歷史**：同樣要自己輪詢、自存（但新鮮度與覆蓋是所有選項裡最好的）。
- **供應商風險**：TalorData 等較新、口碑未明；SerpApi 最成熟但貴。真要用,先用免費試用實測台灣路線的成功率與欄位品質。

### 🔸 Duffel — 不是掃描源，留給未來變現

- 搜尋免費額度 = 「訂單數 × 1500」。我們是掃描多、站內成交近乎 0 → 免費額度≈0 → 每次搜尋 $0.005。
- 粗估稀疏掃描就要 ~$1,000/月，密集可破數千美金。
- **無歷史資料。**
- 強項是真實 NDC 出票 → 等 Phase 3「讓使用者在站內直接訂」時再接，用來變現。

### ❌ Amadeus Self-Service — 已關閉

- 官網公告原文：self-service portal **decommissioned on July 17th**，現在只服務 Enterprise API Portal。
- Enterprise 需業務洽談、為規模化企業設計，不適合獨立開發的原型階段。
- （原本最誘人的是 Flight Price Analysis 會回價格分位數，等於現成的異常基準——但已經拿不到了。）

### ❌ Kiwi.com Tequila — 對新夥伴基本關閉

- Kiwi 2024 聲明：只聚焦「與策略目標高度一致的關鍵夥伴」，對新夥伴採同樣篩選。
- 部分整合商頁面仍宣稱開放，但與官方口徑衝突，可信度低。新獨立專案不建議押注。

---

## 四、最大風險（必須先驗證再投入）

> **Aviasales 快取裡，台灣出發（TPE/TSA/KHH）的路線資料夠不夠密、夠不夠新？**

Travelpayouts 的資料是「真實使用者搜過才會進快取、只留 7 天」。Aviasales 的主力市場在俄語/獨立國協，**台灣出發的冷門路線（尤其長途歐美）很可能資料稀疏甚至沒有**。這會直接決定：
- 熱門線（日韓港澳東南亞）→ 大概率有料，產品站得住。
- 冷門線/長途 → 可能常常空值，榜單撐不起來。

**這不是看文件能定的，要用免費 token 實測。** 這是投入開發前的第一件事。

**兩條路其實是在換風險**：
- **Travelpayouts**：零成本、零法遵風險，但賭台灣快取密度（可能不夠）。
- **Google Flights SERP API**：覆蓋與新鮮度幾乎沒問題，但每月要花錢（可接受）＋ **背法遵/ToS 風險**。

務實做法：**兩個都用免費額度實測同一批台灣路線**，比對覆蓋與欄位品質，再根據「你對法遵風險的接受度 × 覆蓋缺口有多大」決定主力。很可能最後是 **Travelpayouts 當免費主力、熱門線靠它；冷門/長途線用便宜 SERP API 補洞**的混合策略。

---

## 四之二、實測結果（2026-11-03，7 條台灣路線）

用 [`scripts/probe-data-sources.mjs`](../scripts/probe-data-sources.mjs) 實跑，出發 2027-01-02 / 回程 2027-01-09：

| 路線 | Travelpayouts | TalorData |
| --- | --- | --- |
| TPE→NRT 東京 | ✅ 4 筆（NT$9,132） | ✅ 24 筆（$373，直飛 23） |
| TPE→ICN 首爾 | ⬜ 0 | ✅ 12 筆（$322，直飛 12） |
| TPE→HKG 香港 | ⬜ 0 | ✅ 35 筆（$267，直飛 35） |
| KHH→NRT 高雄東京 | ✅ 19 筆（NT$11,596） | ⚠️ 重試 4 次仍失敗 |
| TPE→BKK 曼谷 | ✅ 2 筆（NT$7,087） | ⚠️ 重試 4 次仍失敗 |
| TPE→LHR 倫敦 | ⬜ 0 | ✅ 11 筆（$1,545，直飛 1） |
| TPE→LAX 洛杉磯 | ⬜ 0 | ✅ 11 筆（$1,600，直飛 4） |
| **命中率** | **3/7** | **5/7** |

**結論：兩家高度互補，混合策略成立。**
- **TalorData 補上長途**：倫敦、洛杉磯 Travelpayouts 全 0，TalorData 都有料；熱門線一次回 12–35 筆、含廉航到 STARLUX/EVA，`cache_status:false`＝即時非快取。
- **Travelpayouts 補上 TalorData 當次抓失敗的**：KHH→NRT、曼谷這兩條 TalorData 重試 4 次仍 `error, not search`，但它們其實有票（TP 分別回 19、2 筆）。兩家聯集幾乎可覆蓋全部 7 條。

**實測暴露的三個 TalorData 問題（要納入設計）：**
1. **不穩定**：即時爬 Google，7 條裡 2 條重試 4 次仍失敗。不是沒資料，是當下沒抓到 → 要嘛加大重試/退避，要嘛容忍當次空窗（隔天 cron 會補）。
2. **幣別跑成 USD**：即使帶 `currency=TWD&gl=tw&hl=zh-TW`，價格仍回 `$`（USD）。→ 需自行換匯成 TWD，或再研究正確參數。
3. **無 price_insights/歷史**：回傳不含價格基準 → 異常基準仍須自建（與原計畫一致）。

**Travelpayouts 的侷限**：免費但 patchy（3/7，長途全空），且 `prices_for_dates` 不含 `found_at` 時間戳（要新鮮度得改用 `get_latest_prices`）。

→ **修正後的主力建議：TalorData 當廣度主力（含長途）＋重試機制；Travelpayouts 當免費補充與交叉驗證。** 每天輪詢存快照、USD→TWD、自建 z-score 基準。

## 五、建議的 Phase 1 資料管線

```
每日排程 (cron)
  → 對 3 出發地 × N 目的地 × 取樣日期，打 Travelpayouts Data API
  → 正規化（幣別統一成 TWD、帶上 found_at / expires_at）
  → 寫進自建 DB 的「價格快照」表（這就是我們自己的歷史）
  ↓
累積 N 週後 → 對每條 (origin,dest,月份/天數) 算 rolling mean / std
  → 重用現有 lib/scoring.ts 的 z-score、percentile、Deal Score（邏輯不用改！）
  ↓
前端照舊讀「今日異常便宜榜」，資料從 DB 來而非 generateDeals()
  ↓
使用者點擊 → 用 Travelpayouts deeplink 跳轉（affiliate 佣金）
```

**好消息**：現在 `lib/scoring.ts` 的統計與評分邏輯是真的、可直接重用；要換掉的只有 `lib/deals.ts`（假資料生成）→ 改成讀 DB。產品的「大腦」不用重寫。

---

## 六、建議的下一步（照順序）

1. **[驗證] 用免費額度實測同一批台灣路線，兩個源一起比**：Travelpayouts（免費 token）vs 一家便宜 SERP API（如 TalorData 的 1,000 次免費試用）。各抽幾條熱門線（東京/首爾/香港）+ 冷門長途線（倫敦/洛杉磯），看**回傳筆數、價格合理性、時間戳新鮮度、空值比例**。← 決定主力與是否需要混合。
   - **腳本已備好**：[`scripts/probe-data-sources.mjs`](../scripts/probe-data-sources.mjs)。拿到 token 後執行：
     ```bash
     TP_TOKEN=xxx TALOR_TOKEN=yyy node scripts/probe-data-sources.mjs
     ```
     只給一個 token 也行（另一家自動略過）；加 `PROBE_DUMP=1` 會把原始 JSON 存到 `scripts/probe-output/` 供檢視。
   - **token 怎麼拿**：Travelpayouts → 免費加入 affiliate，在 Profile 的 API token 區取得；TalorData → 在 dashboard.talordata.com 註冊後申請免費試用（1,000 次），到 API 面板複製 token。
2. 依結果定資料源策略，設計價格快照 DB schema + 每日 cron 抓取。
3. 累積 2–4 週快照後，把 `deals.ts` 從假資料切換成「讀 DB + 跑現有 scoring」。
4. 冷門/長途線的空窗，用誠實空狀態處理（現在就有），或之後再補其他源。
5. Phase 3 再評估接 Duffel 做站內成交變現。

---

## 參考來源

- [Amadeus for Developers（首頁公告：self-service 已於 7/17 關閉）](https://developers.amadeus.com/)
- [Travelpayouts Help Center — Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API)
- [Travelpayouts — API rate limits](https://support.travelpayouts.com/hc/en-us/articles/4402565416594-API-rate-limits)
- [Travelpayouts 官網（免費加入 affiliate）](https://www.travelpayouts.com/)
- [Duffel 官方 Pricing](https://duffel.com/pricing)
- [Kiwi.com — 夥伴策略聲明](https://media.kiwi.com/articles-and-interviews/better-for-business-kiwi-com-takes-a-new-approach-to-partnerships/)
- [TalorData — Google 航班抓取 API 介紹](https://www.talordata.com/zh-tw/blog/google-flights-scraper-api)（使用者提供）
- [SerpApi Google Flights 定價（第三方整理）](https://flightpowers.com/compare/serpapi)
- [TalorData 定價（第三方整理）](https://vibecodehq.pages.dev/pricing/talordata-pricing)
