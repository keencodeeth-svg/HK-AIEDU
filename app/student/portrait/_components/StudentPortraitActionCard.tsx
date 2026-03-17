import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { PortraitActionPlan } from "../types";

type StudentPortraitActionCardProps = {
  actionPlan: PortraitActionPlan;
};

export default function StudentPortraitActionCard({ actionPlan }: StudentPortraitActionCardProps) {
  return (
    <Card title="先做这一件事" tag="Action">
      <div className="portrait-action-layout">
        <div className="feature-card portrait-action-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="portrait-action-kicker">{actionPlan.kicker}</div>
            <div className="portrait-action-title">{actionPlan.title}</div>
            <p className="portrait-action-description">{actionPlan.description}</p>
            <div className="meta-text" style={{ marginTop: 8 }}>
              {actionPlan.meta}
            </div>
          </div>
        </div>

        <div className="portrait-action-rail">
          <div className="portrait-action-summary">
            <div className="section-title">推荐顺序</div>
            <div className="meta-text">先执行推荐动作，再回看画像页确认掌握分、薄弱优先级和 Tutor 巩固记录有没有变化。</div>
          </div>
          <div className="cta-row portrait-next-actions">
            <Link className="button primary" href={actionPlan.primaryHref}>
              {actionPlan.primaryLabel}
            </Link>
            <Link className="button secondary" href={actionPlan.secondaryHref}>
              {actionPlan.secondaryLabel}
            </Link>
            <Link className="button ghost" href="/student">
              回到学习控制台
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
