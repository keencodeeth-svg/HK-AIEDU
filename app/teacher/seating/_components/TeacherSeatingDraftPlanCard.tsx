import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { formatLoadedTime } from "@/lib/client-request";
import type { PlanSummary, SeatPlan, TeacherSeatingStudent } from "../types";
import { buildStudentOptionLabel, getStudentDisplayName } from "../utils";

type TeacherSeatingDraftPlanCardProps = {
  draftPlan: SeatPlan;
  draftSummary: PlanSummary | null;
  savedPlan: SeatPlan | null;
  lockedSeatsCount: number;
  frontRowCount: number;
  studentMap: Map<string, TeacherSeatingStudent>;
  lockedSeatIds: string[];
  students: TeacherSeatingStudent[];
  unassignedStudents: TeacherSeatingStudent[];
  onToggleLockedSeat: (seatId: string) => void;
  onSeatAssignmentChange: (seatId: string, nextStudentId?: string) => void;
};

export function TeacherSeatingDraftPlanCard({
  draftPlan,
  draftSummary,
  savedPlan,
  lockedSeatsCount,
  frontRowCount,
  studentMap,
  lockedSeatIds,
  students,
  unassignedStudents,
  onToggleLockedSeat,
  onSeatAssignmentChange
}: TeacherSeatingDraftPlanCardProps) {
  return (
    <Card title="当前座位草稿" tag={draftPlan.generatedBy === "ai" ? "AI 草稿" : "手动草稿"}>
      <div className="feature-card">
        <EduIcon name="board" />
        <p>选学生时如果该学生已在别的位置，系统会自动交换，方便老师快速微调。</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
        <div className="card">
          <div className="section-title">已分配</div>
          <p>{draftSummary?.assignedCount ?? 0} 人</p>
        </div>
        <div className="card">
          <div className="section-title">未分配</div>
          <p>{draftSummary?.unassignedCount ?? 0} 人</p>
        </div>
        <div className="card">
          <div className="section-title">前排需求满足</div>
          <p>
            {draftSummary?.frontPrioritySatisfiedCount ?? 0} / {draftSummary?.frontPriorityStudentCount ?? 0}
          </p>
        </div>
        <div className="card">
          <div className="section-title">已保存版本</div>
          <p>{savedPlan ? formatLoadedTime(savedPlan.updatedAt) : "尚未保存"}</p>
        </div>
      </div>

      {draftSummary?.focusPriorityStudentCount || lockedSeatsCount ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {draftSummary?.focusPriorityStudentCount ? (
            <span className="badge">
              低干扰优先区 {draftSummary.focusPrioritySatisfiedCount} / {draftSummary.focusPriorityStudentCount}
            </span>
          ) : null}
          {lockedSeatsCount ? <span className="badge">已锁定 {lockedSeatsCount} 个座位</span> : null}
        </div>
      ) : null}

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${draftPlan.columns}, 210px)`,
            gap: 12,
            minWidth: `${draftPlan.columns * 210}px`
          }}
        >
          {draftPlan.seats.map((seat) => {
            const student = seat.studentId ? studentMap.get(seat.studentId) : null;
            const locked = lockedSeatIds.includes(seat.seatId);
            return (
              <div
                key={seat.seatId}
                className="card"
                style={{
                  background: seat.row <= frontRowCount ? "rgba(79, 70, 229, 0.06)" : undefined,
                  boxShadow: locked ? "0 0 0 1px rgba(79, 70, 229, 0.45) inset" : undefined
                }}
              >
                <div className="section-title">第 {seat.row} 排 · 第 {seat.column} 列</div>
                <p style={{ marginTop: 6 }}>{getStudentDisplayName(student)}</p>
                <p style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {student ? `${student.placementScore} 分 · ${student.tags.join(" · ") || "资料待补"}` : "当前为空位"}
                </p>
                {student ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <button
                      className="button ghost"
                      type="button"
                      aria-pressed={locked}
                      onClick={() => onToggleLockedSeat(seat.seatId)}
                      style={{ minHeight: 44, padding: "0 12px" }}
                    >
                      {locked ? "取消锁定" : "锁定此座位"}
                    </button>
                    {locked ? <span className="badge">重排保留</span> : null}
                  </div>
                ) : null}
                <select
                  value={seat.studentId ?? ""}
                  onChange={(event) => {
                    const nextStudentId = event.target.value || undefined;
                    onSeatAssignmentChange(seat.seatId, nextStudentId);
                  }}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)", marginTop: 8 }}
                >
                  <option value="">设为空位</option>
                  {students.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {buildStudentOptionLabel(candidate)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="section-title">未分配学生</div>
        {unassignedStudents.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {unassignedStudents.map((student) => (
              <span key={student.id} className="badge">
                {getStudentDisplayName(student)} · {student.placementScore}分
              </span>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--ink-1)", marginTop: 8 }}>当前草稿已覆盖全部学生。</p>
        )}
      </div>
    </Card>
  );
}
