import Link from "next/link";
import Card from "@/components/Card";
import type { RoleLaunchCard } from "../home.types";

export function HomeRoleLaunchSection({ roleLaunchCards }: { roleLaunchCards: RoleLaunchCard[] }) {
  return (
    <section className="grid" style={{ gap: 14 }}>
      <div className="section-head">
        <div>
          <h2>我想以什么身份开始</h2>
          <div className="section-sub">首日别再自己找入口，按角色直接进最合适的工作台。</div>
        </div>
        <span className="chip">Role-first</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {roleLaunchCards.map((item) => (
          <Card key={item.id} title={item.title} tag={item.tag}>
            <div className="grid" style={{ gap: 10 }}>
              <p>{item.subtitle}</p>
              <div className="badge-row">
                {item.highlights.map((highlight) => (
                  <span className="badge" key={`${item.id}-${highlight}`}>
                    {highlight}
                  </span>
                ))}
              </div>
              <div className="cta-row" style={{ flexWrap: "wrap" }}>
                <Link className="button primary" href={item.primaryHref}>
                  {item.primaryLabel}
                </Link>
                {item.secondaryHref && item.secondaryLabel ? (
                  <Link className="button ghost" href={item.secondaryHref}>
                    {item.secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
