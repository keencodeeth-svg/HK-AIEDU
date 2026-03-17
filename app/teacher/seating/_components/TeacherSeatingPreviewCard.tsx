import { getFrontRowCount } from "@/lib/seat-plan-utils";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { PlanSummary, SeatPlan, TeacherSeatingStudent } from "../types";
import { getStudentDisplayName } from "../utils";

type TeacherSeatingPreviewCardProps = {
  previewPlan: SeatPlan | null;
  previewSummary: PlanSummary | null;
  previewWarnings: string[];
  previewInsights: string[];
  studentMap: Map<string, TeacherSeatingStudent>;
  lockedSeatIds: string[];
};

export function TeacherSeatingPreviewCard({
  previewPlan,
  previewSummary,
  previewWarnings,
  previewInsights,
  studentMap,
  lockedSeatIds
}: TeacherSeatingPreviewCardProps) {
  return (
    <Card title="学期方案预览" tag="预览">
      {!previewPlan ? (
        <StatePanel
          title="还没有生成学期预览"
          description="点击上方“生成学期预览”，系统会先安排前排需求，再尝试做成绩互补和性别、身高平衡。"
          tone="info"
          compact
        />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div className="card">
              <div className="section-title">已分配</div>
              <p>{previewSummary?.assignedCount ?? 0} 人</p>
            </div>
            <div className="card">
              <div className="section-title">未分配</div>
              <p>{previewSummary?.unassignedCount ?? 0} 人</p>
            </div>
            <div className="card">
              <div className="section-title">前排满足</div>
              <p>
                {previewSummary?.frontPrioritySatisfiedCount ?? 0} / {previewSummary?.frontPriorityStudentCount ?? 0}
              </p>
            </div>
            <div className="card">
              <div className="section-title">互补同桌</div>
              <p>{previewSummary?.scoreComplementPairCount ?? 0} 组</p>
            </div>
          </div>

          {previewSummary?.focusPriorityStudentCount ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge">
                低干扰优先区 {previewSummary.focusPrioritySatisfiedCount} / {previewSummary.focusPriorityStudentCount}
              </span>
              {previewSummary.lockedSeatCount ? <span className="badge">保留锁定位 {previewSummary.lockedSeatCount} 个</span> : null}
            </div>
          ) : previewSummary?.lockedSeatCount ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge">保留锁定位 {previewSummary.lockedSeatCount} 个</span>
            </div>
          ) : null}

          {previewWarnings.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {previewWarnings.map((warning) => (
                <span key={warning} className="badge" style={{ borderColor: "#f04438", color: "#b42318" }}>
                  {warning}
                </span>
              ))}
            </div>
          ) : null}

          {previewInsights.length ? (
            <div className="grid" style={{ gap: 8 }}>
              {previewInsights.map((insight) => (
                <div key={insight} className="card">
                  {insight}
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${previewPlan.columns}, 170px)`,
                gap: 12,
                minWidth: `${previewPlan.columns * 170}px`
              }}
            >
              {previewPlan.seats.map((seat) => {
                const student = seat.studentId ? studentMap.get(seat.studentId) : null;
                const locked = lockedSeatIds.includes(seat.seatId);
                return (
                  <div
                    key={`preview-${seat.seatId}`}
                    className="card"
                    style={{
                      background: seat.row <= getFrontRowCount(previewPlan.rows) ? "rgba(79, 70, 229, 0.06)" : undefined,
                      boxShadow: locked ? "0 0 0 1px rgba(79, 70, 229, 0.45) inset" : undefined
                    }}
                  >
                    <div className="section-title">第 {seat.row} 排 · 第 {seat.column} 列</div>
                    <p>{getStudentDisplayName(student)}</p>
                    <p style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      {student ? `${student.placementScore} 分 · ${student.tags.join(" · ") || "资料待补"}` : "空位"}
                    </p>
                    {locked ? <span className="badge">锁定保留</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
