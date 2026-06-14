import Link from "next/link";
import type { Deal } from "@/lib/deals";
import {
  checkedAtLabel,
  duration,
  leaveLabel,
  ntd,
  shortDate,
} from "@/lib/format";
import ScoreGauge from "./ScoreGauge";

export default function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link href={`/deals/${deal.id}`} className="deal">
      <div className="deal-top">
        <div>
          <div className="route">
            {deal.origin} <span className="arrow">→</span> {deal.destination}
            <span className="city">{deal.destCity}</span>
            <span className={`label-badge label-${deal.label}`}>
              {deal.label}
            </span>
          </div>
          <div className="meta-line">
            <span>
              {shortDate(deal.departureDate)} – {shortDate(deal.returnDate)}
            </span>
            <span>來回 {deal.tripLength} 晚</span>
            <span>
              {deal.direct ? "直飛" : `轉機 ${deal.stops} 次`} ·{" "}
              {duration(deal.durationMinutes)} · {deal.airline}
            </span>
            <span
              className={`leave ${deal.weekendFriendly || deal.leaveDaysNeeded === 0 ? "leave-ok" : ""}`}
            >
              🗓 {leaveLabel(deal.weekendFriendly, deal.leaveDaysNeeded)}
            </span>
          </div>
        </div>
        <div className="deal-gauge">
          <ScoreGauge value={deal.score.final} label={deal.label} />
        </div>
      </div>

      <div className="price-row">
        <span className="price-now">{ntd(deal.price)}</span>
        <span className="price-was">
          平常約 <s>{ntd(deal.historicalMedian)}</s>
        </span>
        {deal.estimatedSavings > 0 && (
          <span className="savings">省 {ntd(deal.estimatedSavings)}</span>
        )}
        <span className="zchip">
          z {deal.z.toFixed(2)} · 低於 {deal.percentileCheaper}%
        </span>
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

      <div className="deal-foot">
        <div className="trust">
          <span>最後檢查：{checkedAtLabel(deal.checkedAt)}</span>
          <span>來源：{deal.source}</span>
          {deal.revalidated && (
            <span className="revalidated">✓ 已重新驗證</span>
          )}
          {deal.stale && (
            <span className="stale-flag">⚠ 價格可能已變動</span>
          )}
        </div>
        <span style={{ color: "var(--fox-soft)" }}>查看詳情 →</span>
      </div>
    </Link>
  );
}
