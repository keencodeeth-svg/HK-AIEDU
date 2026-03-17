import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { PlanSummary, TeacherSeatingStudent } from "../types";
import { getStudentDisplayName, isFocusPriorityStudent, isFrontPriorityStudent } from "../utils";

type TeacherSeatingFollowUpCardProps = {
  draftSummary: PlanSummary | null;
  studentsNeedingProfileReminder: TeacherSeatingStudent[];
  watchStudents: TeacherSeatingStudent[];
  includeParentsInReminder: boolean;
  followUpActing: null | "remind" | "copy";
  followUpError: string | null;
  followUpMessage: string | null;
  onIncludeParentsChange: (value: boolean) => void;
  onRemindIncompleteProfiles: () => void;
  onCopyFollowUpChecklist: () => void;
};

export function TeacherSeatingFollowUpCard({
  draftSummary,
  studentsNeedingProfileReminder,
  watchStudents,
  includeParentsInReminder,
  followUpActing,
  followUpError,
  followUpMessage,
  onIncludeParentsChange,
  onRemindIncompleteProfiles,
  onCopyFollowUpChecklist
}: TeacherSeatingFollowUpCardProps) {
  return (
    <Card title="学期收口动作" tag="跟进">
      <div className="feature-card">
        <EduIcon name="rocket" />
        <p>学期方案确定后，建议一次性处理资料待补学生，并保留一份观察清单，后续只在必要时复盘和微调。</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
        <div className="card">
          <div className="section-title">资料待补</div>
          <p>{studentsNeedingProfileReminder.length} 人</p>
        </div>
        <div className="card">
          <div className="section-title">前排仍需关注</div>
          <p>{Math.max(0, (draftSummary?.frontPriorityStudentCount ?? 0) - (draftSummary?.frontPrioritySatisfiedCount ?? 0))} 人</p>
        </div>
        <div className="card">
          <div className="section-title">低干扰仍需关注</div>
          <p>{Math.max(0, (draftSummary?.focusPriorityStudentCount ?? 0) - (draftSummary?.focusPrioritySatisfiedCount ?? 0))} 人</p>
        </div>
        <div className="card">
          <div className="section-title">重点观察</div>
          <p>{watchStudents.length} 人</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <label className="card" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeParentsInReminder}
            onChange={(event) => onIncludeParentsChange(event.target.checked)}
            style={{ marginRight: 8 }}
          />
          同步提醒家长
        </label>
        <button
          className="button secondary"
          type="button"
          onClick={onRemindIncompleteProfiles}
          disabled={followUpActing !== null || !studentsNeedingProfileReminder.length}
        >
          {followUpActing === "remind" ? "发送中..." : "发送补齐提醒"}
        </button>
        <button
          className="button ghost"
          type="button"
          onClick={onCopyFollowUpChecklist}
          disabled={followUpActing !== null}
        >
          {followUpActing === "copy" ? "复制中..." : "复制学期观察清单"}
        </button>
      </div>

      {followUpError ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{followUpError}</div> : null}
      {followUpMessage ? <div style={{ color: "#027a48", fontSize: 13, marginTop: 12 }}>{followUpMessage}</div> : null}

      <div className="grid" style={{ gap: 12, marginTop: 12 }}>
        <div className="card">
          <div className="section-title">待补资料学生</div>
          {studentsNeedingProfileReminder.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {studentsNeedingProfileReminder.slice(0, 10).map((student) => (
                <span key={`remind-${student.id}`} className="badge">
                  {getStudentDisplayName(student)} · 缺 {student.missingProfileFields.length} 项
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--ink-1)", marginTop: 8 }}>本班用于学期排座的关键画像已补齐。</p>
          )}
        </div>
        <div className="card">
          <div className="section-title">重点观察名单</div>
          {watchStudents.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {watchStudents.slice(0, 6).map((student) => {
                const reasons = [] as string[];
                if (isFrontPriorityStudent(student)) reasons.push("前排关注");
                if (isFocusPriorityStudent(student)) reasons.push("低干扰优先");
                if (student.missingProfileFields.length) reasons.push("资料待补");
                return (
                  <div key={`watch-${student.id}`} style={{ fontSize: 13 }}>
                    {getStudentDisplayName(student)} · {reasons.join(" / ")}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--ink-1)", marginTop: 8 }}>当前没有需要重点跟进的学生。</p>
          )}
        </div>
      </div>
    </Card>
  );
}
