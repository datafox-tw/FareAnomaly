import type { Metadata } from "next";
import Link from "next/link";
import AccountButton from "@/components/AccountButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "FareAnomaly — 機票異常便宜雷達",
  description:
    "FareAnomaly 每天掃描機票市場，找出低於平常價格的異常便宜旅行機會。不要問去哪裡，先看哪裡便宜到不合理。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <Link href="/" className="brand">
              <span className="logo">🦊</span>
              <span>
                Fare<span className="accent">Anomaly</span>
              </span>
            </Link>
            <nav className="nav">
              <Link href="/">今日神票榜</Link>
              <Link href="/alerts">票價雷達</Link>
              <AccountButton />
            </nav>
          </div>
        </header>
        {children}
        <footer className="site">
          <div className="container">
            FareAnomaly · Phase 0 原型（示範資料）· 不提供訂票，僅提供外部查詢連結 ·
            票價可能隨時變動，請以訂票頁面為準。
          </div>
        </footer>
      </body>
    </html>
  );
}
