import Link from "next/link";
import { notFound } from "next/navigation";
import { DEALS, dealById } from "@/lib/deals";
import { airportOf } from "@/lib/deals";
import {
  checkedAtLabel,
  duration,
  leaveLabel,
  ntd,
  slashDate,
} from "@/lib/format";
import ScoreGauge from "@/components/ScoreGauge";
import ScoreBreakdown from "@/components/ScoreBreakdown";

export function generateStaticParams() {
  return DEALS.map((d) => ({ id: d.id }));
}

export default async function DealDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = dealById(id);
  if (!deal) notFound();
  const ap = airportOf(deal.destination);

  return (
    <div className="container">
      <Link href="/" className="back">
        ← 回到今日神票榜
      </Link>

      <div className="detail-grid">
        <div>
          <div className="panel">
            <div className="deal-top">
              <div>
                <h2>
                  {deal.origin} → {deal.destination}
                </h2>
                <div className="meta-line">
                  <span>
                    {deal.destCity}
                    {ap ? ` · ${ap.country}` : ""}
                  </span>
                  <span>
                    {slashDate(deal.departureDate)} –{" "}
                    {slashDate(deal.returnDate)}
                  </span>
                  <span>來回 {deal.tripLength} 晚</span>
                  <span
                    className={`leave ${deal.weekendFriendly || deal.leaveDaysNeeded === 0 ? "leave-ok" : ""}`}
                  >
                    🗓 {leaveLabel(deal.weekendFriendly, deal.leaveDaysNeeded)}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ScoreGauge
                  value={deal.score.final}
                  label={deal.label}
                  size={84}
                />
                <span className={`label-badge label-${deal.label}`}>
                  {deal.label}
                </span>
              </div>
            </div>

            <div className="price-row">
              <span className="price-now">{ntd(deal.price)}</span>
              <span className="price-was">
                平常約 <s>{ntd(deal.historicalMedian)}</s>
              </span>
              {deal.estimatedSavings > 0 && (
                <span className="savings">
                  省 {ntd(deal.estimatedSavings)}
                </span>
              )}
            </div>

            <p className="explain">{deal.explanation}</p>
            <p className="fox-take">{deal.foxTake}</p>

            {deal.score.penalties.length > 0 && (
              <div className="penalties">
                {deal.score.penalties.map((p) => (
                  <span className="penalty" key={p}>
                    ⚠ {p}
                  </span>
                ))}
              </div>
            )}

            <a
              href={deal.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ marginTop: 18 }}
            >
              前往查詢 / 訂票 ↗
            </a>

            <div className="notice">
              最後檢查：{checkedAtLabel(deal.checkedAt)}（來源：{deal.source}）。
              票價可能隨時變動，請以訂票頁面為準。Flight Fox 不負責訂票，僅提供外部查詢連結。
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0 }}>Deal Score 拆解</h3>
            <p
              style={{
                color: "var(--text-faint)",
                fontSize: 12.5,
                marginTop: 0,
                marginBottom: 16,
              }}
            >
              每一段的寬度就是它對最終分數的實際貢獻：分數 × 權重。四段相加 ={" "}
              {deal.score.final}。
            </p>
            <ScoreBreakdown score={deal.score} />
          </div>
        </div>

        <aside>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>統計細節</h3>
            <div className="kv">
              <span className="k">z-score</span>
              <span className="v">{deal.z.toFixed(2)}</span>
            </div>
            <div className="kv">
              <span className="k">百分位</span>
              <span className="v">低於 {deal.percentileCheaper}% 同類票</span>
            </div>
            <div className="kv">
              <span className="k">歷史中位數</span>
              <span className="v">{ntd(deal.historicalMedian)}</span>
            </div>
            <div className="kv">
              <span className="k">歷史平均</span>
              <span className="v">{ntd(deal.historicalMean)}</span>
            </div>
            <div className="kv">
              <span className="k">標準差</span>
              <span className="v">{ntd(deal.historicalStd)}</span>
            </div>
            <div className="kv">
              <span className="k">樣本數</span>
              <span className="v">{deal.sampleSize} 筆</span>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0 }}>航班資訊</h3>
            <div className="kv">
              <span className="k">航空公司</span>
              <span className="v">{deal.airline}</span>
            </div>
            <div className="kv">
              <span className="k">轉機</span>
              <span className="v">
                {deal.direct ? "直飛" : `${deal.stops} 次`}
              </span>
            </div>
            <div className="kv">
              <span className="k">飛行時間（單程）</span>
              <span className="v">{duration(deal.durationMinutes)}</span>
            </div>
            <div className="kv">
              <span className="k">紅眼班機</span>
              <span className="v">{deal.redEye ? "是" : "否"}</span>
            </div>
            {ap && (
              <>
                <div className="kv">
                  <span className="k">簽證</span>
                  <span className="v">{ap.visaNote}</span>
                </div>
                <div className="kv">
                  <span className="k">請假天數（參考）</span>
                  <span className="v">
                    {leaveLabel(deal.weekendFriendly, deal.leaveDaysNeeded)}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">標籤</span>
                  <span className="v">{ap.tags.join("、")}</span>
                </div>
              </>
            )}
            <div className="kv">
              <span className="k">已重新驗證</span>
              <span
                className="v"
                style={{
                  color: deal.revalidated ? "var(--cheap)" : "var(--text-faint)",
                }}
              >
                {deal.revalidated ? "是 ✓" : "尚未"}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
