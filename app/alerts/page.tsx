"use client";

import { useState } from "react";
import Link from "next/link";
import { ORIGINS, ORIGIN_LABEL, REGIONS, type Region } from "@/lib/airports";
import { ntd } from "@/lib/format";
import {
  addAlert,
  removeAlert,
  useAlerts,
  useUser,
  type Channel,
} from "@/lib/useAuth";

const CHANNELS: {
  key: Channel;
  emoji: string;
  label: string;
  targetLabel: string;
  placeholder: string;
  note: string;
}[] = [
  {
    key: "line",
    emoji: "💬",
    label: "LINE",
    targetLabel: "LINE 通知 token",
    placeholder: "LINE Messaging API / Notify token",
    note: "理想首選。正式版會用 LINE Official Account + Messaging API 主動推播；先綁定你的 user id 即可。",
  },
  {
    key: "telegram",
    emoji: "✈️",
    label: "Telegram",
    targetLabel: "Telegram chat id",
    placeholder: "例如 123456789",
    note: "最快驗證：用 @BotFather 建一個 bot 拿 token，把你的 chat id 填這裡，原型就能推播。",
  },
  {
    key: "discord",
    emoji: "🎮",
    label: "Discord",
    targetLabel: "Discord webhook URL",
    placeholder: "https://discord.com/api/webhooks/...",
    note: "在頻道設定建立 Webhook，貼上網址即可。適合丟到旅遊社群頻道。",
  },
  {
    key: "email",
    emoji: "📧",
    label: "Email",
    targetLabel: "收件 Email",
    placeholder: "you@example.com",
    note: "最通用但設定較繁瑣（需寄信服務）。預設用你的登入信箱。",
  },
];

export default function AlertsPage() {
  const user = useUser();
  const myAlerts = useAlerts(user?.email);

  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>("TPE");
  const [region, setRegion] = useState<Region | "ALL">("日本");
  const [dateStart, setDateStart] = useState("2026-08-01");
  const [dateEnd, setDateEnd] = useState("2026-09-30");
  const [maxPrice, setMaxPrice] = useState(6000);
  const [maxZ, setMaxZ] = useState(-2);
  const [tripMin, setTripMin] = useState(2);
  const [tripMax, setTripMax] = useState(8);
  const [channel, setChannel] = useState<Channel>("line");
  const [target, setTarget] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const ch = CHANNELS.find((c) => c.key === channel)!;
  const pct = Math.round((1 - normalCdf(maxZ)) * 100);
  const effectiveTarget =
    channel === "email" && !target ? user?.email ?? "" : target;

  const preview = `🦊 發現神票：${origin} → FUK，來回 ${ntd(3900)}
比過去 ${pct}% 的同類票都便宜，低於平常約 ${Math.abs(maxZ).toFixed(1)} 個標準差。
出發：2026/09/12，回程：2026/09/16
狐狸銳評：短途、價格漂亮、時間正常，值得點進去確認。
查詢連結：fareanomaly.app/deals/...`;

  if (!user) {
    return (
      <div
        className="container alert-form"
        style={{ textAlign: "center", maxWidth: 460 }}
      >
        <div style={{ fontSize: 44 }}>🦊🔔</div>
        <h1 style={{ fontSize: 26 }}>先登入，才能設定票價雷達</h1>
        <p style={{ color: "var(--text-dim)" }}>
          訂閱要綁定一個帳號，神票出現時才知道要通知誰。登入只需要一個 email。
        </p>
        <Link href="/login" className="btn btn-primary">
          登入 / 註冊
        </Link>
      </div>
    );
  }

  function save() {
    addAlert({
      email: user!.email,
      origin,
      region,
      dateStart,
      dateEnd,
      tripMin,
      tripMax,
      maxPrice,
      maxZ,
      channel,
      channelTarget: effectiveTarget,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2600);
  }

  return (
    <div className="container alert-form">
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>設定我的票價雷達</h1>
      <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
        以 <b>{user.email}</b> 登入中。設定條件，當符合的異常便宜票出現時主動通知你，
        不用每天自己打開網站。
      </p>

      <div className="section-title">搜尋條件</div>

      <div className="field">
        <label>出發地</label>
        <select
          value={origin}
          onChange={(e) =>
            setOrigin(e.target.value as (typeof ORIGINS)[number])
          }
        >
          {ORIGINS.map((o) => (
            <option key={o} value={o}>
              {ORIGIN_LABEL[o]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>目的區域</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as Region | "ALL")}
        >
          <option value="ALL">任何區域</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>最早出發</label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>最晚出發</label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>最短旅程（晚）</label>
          <input
            type="number"
            min={1}
            max={30}
            value={tripMin}
            onChange={(e) => setTripMin(Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>最長旅程（晚）</label>
          <input
            type="number"
            min={1}
            max={30}
            value={tripMax}
            onChange={(e) => setTripMax(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>
          票價上限 <span className="range-val">{ntd(maxPrice)}</span>
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
          最低異常門檻{" "}
          <span className="range-val">
            z ≤ {maxZ.toFixed(1)}（比過去 {pct}% 便宜）
          </span>
        </label>
        <input
          type="range"
          min={-3}
          max={-1}
          step={0.1}
          value={maxZ}
          onChange={(e) => setMaxZ(Number(e.target.value))}
        />
        <div
          style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}
        >
          越嚴格（越負）通知越少但越精準。z ≤ -2.0 大約等於「神票」等級。
        </div>
      </div>

      <div className="section-title">通知方式</div>
      <div className="field">
        <div className="chips">
          {CHANNELS.map((c) => (
            <span
              key={c.key}
              className={`chip ${channel === c.key ? "active" : ""}`}
              onClick={() => {
                setChannel(c.key);
                setTarget("");
              }}
            >
              {c.emoji} {c.label}
            </span>
          ))}
        </div>
        <div className="channel-note">{ch.note}</div>
      </div>

      <div className="field">
        <label>{ch.targetLabel}</label>
        <input
          type="text"
          value={
            channel === "email" && !target ? user.email : target
          }
          placeholder={ch.placeholder}
          onChange={(e) => setTarget(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 11px",
            background: "var(--bg-soft)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            color: "var(--text)",
            fontSize: 13.5,
          }}
        />
      </div>

      <div className="section-title">通知預覽</div>
      <div className="preview-card">{preview}</div>

      <button
        className="btn btn-primary"
        style={{ marginTop: 22 }}
        onClick={save}
        disabled={!effectiveTarget}
      >
        {justSaved ? "✓ 雷達已建立" : "建立票價雷達"}
      </button>
      {justSaved && (
        <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 10 }}>
          Phase 0 原型：雷達存在你的瀏覽器，尚未真正推播。Phase 3 會接上{" "}
          {ch.label} 並做去重，避免重複通知。
        </p>
      )}

      {myAlerts.length > 0 && (
        <>
          <div className="section-title">我的雷達（{myAlerts.length}）</div>
          <div className="alert-list">
            {myAlerts.map((a) => {
              const c = CHANNELS.find((x) => x.key === a.channel)!;
              return (
                <div className="alert-item" key={a.id}>
                  <div>
                    <div className="alert-item-title">
                      {a.origin} → {a.region === "ALL" ? "任何區域" : a.region}
                      <span className="alert-item-z">z ≤ {a.maxZ}</span>
                    </div>
                    <div className="alert-item-meta">
                      {a.dateStart} ~ {a.dateEnd} · {a.tripMin}–{a.tripMax} 晚 ·
                      ≤ {ntd(a.maxPrice)} · {c.emoji} {c.label}
                    </div>
                  </div>
                  <button
                    className="alert-remove"
                    onClick={() => removeAlert(a.id)}
                  >
                    移除
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Standard normal CDF (mirrors lib/scoring). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}
