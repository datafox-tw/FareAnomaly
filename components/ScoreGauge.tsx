import type { DealLabel } from "@/lib/scoring";

const LABEL_COLOR: Record<DealLabel, string> = {
  神票: "var(--god)",
  很便宜: "var(--cheap)",
  可考慮: "var(--ok)",
  普通: "var(--normal)",
};

/** Circular Deal Score gauge. */
export default function ScoreGauge({
  value,
  label,
  size = 64,
}: {
  value: number;
  label: DealLabel;
  size?: number;
}) {
  const stroke = size <= 64 ? 6 : 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const color = LABEL_COLOR[label];

  return (
    <div
      className="gauge"
      style={{ width: size, height: size }}
      aria-label={`Deal Score ${value}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="gauge-val" style={{ color }}>
        <strong style={{ fontSize: size <= 64 ? 18 : 26 }}>{value}</strong>
        <span style={{ fontSize: size <= 64 ? 8 : 10 }}>SCORE</span>
      </div>
    </div>
  );
}
