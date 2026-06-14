import type { ScoreBreakdown as SB } from "@/lib/scoring";

// Each component's weighted contribution to the final score (PRD §10.5).
const PARTS = [
  { key: "anomaly", label: "異常程度", weight: 0.45, color: "var(--fox)" },
  { key: "price", label: "絕對價格", weight: 0.25, color: "var(--cheap)" },
  { key: "quality", label: "航班品質", weight: 0.2, color: "var(--ok)" },
  {
    key: "feasibility",
    label: "可行性",
    weight: 0.1,
    color: "var(--fox-soft)",
  },
] as const;

/** Stacked weighted-contribution bar — the segments literally sum to the final score. */
export default function ScoreBreakdown({ score }: { score: SB }) {
  const parts = PARTS.map((p) => ({
    ...p,
    raw: score[p.key],
    contrib: score[p.key] * p.weight,
  }));

  return (
    <div className="breakdown">
      <div className="breakdown-bar">
        {parts.map((p) => (
          <span
            key={p.key}
            className="seg"
            title={`${p.label} ${p.raw} × ${p.weight} = ${p.contrib.toFixed(1)}`}
            style={{ width: `${p.contrib}%`, background: p.color }}
          />
        ))}
      </div>
      <div className="breakdown-legend">
        {parts.map((p) => (
          <div className="legend-row" key={p.key}>
            <span className="dot" style={{ background: p.color }} />
            <span className="leg-label">{p.label}</span>
            <span className="leg-weight">×{p.weight}</span>
            <span className="leg-bar">
              <span style={{ width: `${p.raw}%`, background: p.color }} />
            </span>
            <span className="leg-raw">{p.raw}</span>
            <span className="leg-contrib">+{p.contrib.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <div className="breakdown-total">
        <span>最終 Deal Score</span>
        <strong>{score.final}</strong>
      </div>
    </div>
  );
}
