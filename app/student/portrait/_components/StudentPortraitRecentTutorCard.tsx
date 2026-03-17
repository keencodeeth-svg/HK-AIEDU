import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { formatLoadedTime } from "@/lib/client-request";
import type { RecentStudyVariantActivity } from "../types";

type StudentPortraitRecentTutorCardProps = {
  activity: RecentStudyVariantActivity;
  summary: string;
  practiceHref: string;
  tutorHref: string;
};

export default function StudentPortraitRecentTutorCard({
  activity,
  summary,
  practiceHref,
  tutorHref
}: StudentPortraitRecentTutorCardProps) {
  return (
    <Card title="最近 Tutor 巩固" tag="即时变化">
      <div className="feature-card">
        <EduIcon name="brain" />
        <div>
          <div className="section-title">{activity.latestKnowledgePointTitle}</div>
          <p>{summary}</p>
        </div>
      </div>
      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">24小时巩固 {activity.recentAttemptCount} 题</span>
        <span className="pill">答对 {activity.recentCorrectCount} 题</span>
        <span className="pill">掌握 {activity.masteryScore}</span>
        {typeof activity.weaknessRank === "number" ? <span className="pill">薄弱位次 #{activity.weaknessRank}</span> : null}
        <span className="pill">更新于 {formatLoadedTime(activity.latestAttemptAt)}</span>
      </div>
      <div className="cta-row portrait-next-actions" style={{ marginTop: 12 }}>
        <Link className="button secondary" href={practiceHref}>
          延续巩固
        </Link>
        <Link className="button ghost" href={tutorHref}>
          回到 Tutor
        </Link>
      </div>
    </Card>
  );
}
