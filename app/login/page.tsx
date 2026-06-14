"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, useUser, logout } from "@/lib/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const user = useUser();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (user) {
    return (
      <div className="container alert-form" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🦊</div>
        <h1 style={{ fontSize: 26 }}>已登入</h1>
        <p style={{ color: "var(--text-dim)" }}>
          目前以 <b>{user.email}</b> 登入。你的票價雷達都會綁定這個信箱。
        </p>
        <div className="cta-row">
          <button
            className="btn btn-primary"
            onClick={() => router.push("/alerts")}
          >
            設定票價雷達
          </button>
          <button className="btn" onClick={() => logout()}>
            登出
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container alert-form" style={{ maxWidth: 440 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🦊</div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>登入 FareAnomaly</h1>
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          只要一個 email。登入後就能訂閱神票通知，便宜票出現時主動寄給你。
        </p>
      </div>

      {!sent ? (
        <>
          <div className="field" style={{ marginTop: 20 }}>
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-soft)",
                border: "1px solid var(--border)",
                borderRadius: 9,
                color: "var(--text)",
                fontSize: 14,
              }}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={!valid}
            onClick={() => setSent(true)}
          >
            寄送登入連結
          </button>
          <p
            style={{
              color: "var(--text-faint)",
              fontSize: 12,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Phase 0 原型：不會真的寄信，直接模擬 magic-link 登入。
          </p>
        </>
      ) : (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ color: "var(--text-dim)" }}>
            （示範）我們「寄了」一封登入連結到 <b>{email}</b>。
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              login(email);
              router.push("/alerts");
            }}
          >
            模擬點擊登入連結 →
          </button>
        </div>
      )}
    </div>
  );
}
