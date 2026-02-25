import Card from "@/components/Card";
import { getCurrentUser } from "@/lib/auth";
import { generateStudyPlans, getStudyPlans } from "@/lib/progress";
import { getMasteryRecordsByUser, indexMasteryByKnowledgePoint } from "@/lib/mastery";
import { getKnowledgePoints } from "@/lib/content";
import { getStudentProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return (
      <Card title="学习计划">
        <p>请先登录学生账号。</p>
      </Card>
    );
  }

  const profile = await getStudentProfile(user.id);
  const subjects = profile?.subjects?.length ? profile.subjects : ["math"];
  const plans = await getStudyPlans(user.id, subjects);
  const finalPlans = plans.length ? plans : await generateStudyPlans(user.id, subjects);
  const masteryRecords = await getMasteryRecordsByUser(user.id);
  const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
  const knowledgePoints = await getKnowledgePoints();
  const labelMap: Record<string, string> = {
    math: "数学",
    chinese: "语文",
    english: "英语"
  };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习计划</h2>
          <div className="section-sub">7 天游学节奏，聚焦掌握与巩固。</div>
        </div>
        <span className="chip">自动规划</span>
      </div>
      <Card title="学习计划" tag="7 天">
        <p>为你生成 7 天游学计划（多学科）。</p>
        <div className="pill-list" style={{ marginTop: 10 }}>
          {subjects.map((subject) => (
            <span className="pill" key={subject}>
              {labelMap[subject] ?? subject}
            </span>
          ))}
        </div>
        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          {finalPlans.map((plan) => (
            <div className="card" key={plan.subject}>
              <div className="section-title">{labelMap[plan.subject] ?? plan.subject}</div>
              <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                {plan.items.map((item) => {
                  const kp = knowledgePoints.find((k) => k.id === item.knowledgePointId);
                  const mastery = masteryMap.get(item.knowledgePointId);
                  return (
                    <div key={item.knowledgePointId}>
                      {kp?.title ?? "知识点"} · 目标 {item.targetCount} 题 · 截止{" "}
                      {new Date(item.dueDate).toLocaleDateString("zh-CN")}
                      {mastery ? ` · 掌握 ${mastery.masteryScore} 分` : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
