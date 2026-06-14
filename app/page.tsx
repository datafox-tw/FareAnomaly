import Link from "next/link";
import DealBoard from "@/components/DealBoard";
import { DEALS } from "@/lib/deals";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>
            找到便宜到<span className="accent">不合理</span>的機票。
          </h1>
          <p>
            FareAnomaly 每天掃描台灣出發的機票市場，找出低於平常價格的異常便宜旅行機會。
            不要問去哪裡，先看哪裡便宜到不合理。
          </p>
          <div className="cta-row">
            <a href="#board" className="btn btn-primary">
              查看今日神票
            </a>
            <Link href="/alerts" className="btn">
              設定我的票價雷達
            </Link>
          </div>
        </div>
      </section>

      <div id="board" />
      <DealBoard deals={DEALS} />
    </>
  );
}
