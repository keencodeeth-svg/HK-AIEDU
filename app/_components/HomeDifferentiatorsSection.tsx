import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { CapabilityBlock, Differentiator } from "../home.types";

export function HomeDifferentiatorsSection({
  differentiators,
  capabilityBlocks
}: {
  differentiators: Differentiator[];
  capabilityBlocks: CapabilityBlock[];
}) {
  return (
    <section className="grid grid-2">
      <Card title="为什么这套产品不一样" tag="闭环">
        <div className="grid" style={{ gap: 10 }}>
          {differentiators.map((item) => (
            <div key={item.title} className="card">
              <div className="section-title">{item.title}</div>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="核心能力总览" tag="Capabilities">
        <div className="grid" style={{ gap: 10 }}>
          {capabilityBlocks.map((item) => (
            <Link key={item.title} href={item.href} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="feature-card" style={{ alignItems: "flex-start" }}>
                <EduIcon name={item.icon} />
                <div>
                  <div className="section-title">{item.title}</div>
                  <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.7 }}>
                    {item.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
}
