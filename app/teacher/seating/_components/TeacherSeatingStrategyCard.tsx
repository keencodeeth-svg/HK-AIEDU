import type { Dispatch, SetStateAction } from "react";
import type { SeatCell } from "@/lib/seat-plan-utils";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { formatLoadedTime } from "@/lib/client-request";
import type { AiOptions, PlanSummary, TeacherClassItem, TeacherSeatingStudent } from "../types";
import { LAYOUT_OPTIONS, getStudentDisplayName } from "../utils";

type TeacherSeatingStrategyCardProps = {
  classes: TeacherClassItem[];
  classId: string;
  draftSummary: PlanSummary | null;
  aiOptions: AiOptions;
  keepLockedSeats: boolean;
  lockedSeats: Array<SeatCell & { studentId: string }>;
  layoutRows: number;
  layoutColumns: number;
  studentsCount: number;
  lastLoadedAt: string | null;
  studentMap: Map<string, TeacherSeatingStudent>;
  pageError: string | null;
  saveError: string | null;
  saveMessage: string | null;
  refreshing: boolean;
  previewing: boolean;
  saving: boolean;
  hasPreviewPlan: boolean;
  hasSavedPlan: boolean;
  setAiOptions: Dispatch<SetStateAction<AiOptions>>;
  onKeepLockedSeatsChange: (value: boolean) => void;
  onRefresh: () => void;
  onGeneratePreview: () => void;
  onApplyPreview: () => void;
  onRestoreSaved: () => void;
  onSavePlan: () => void;
  onClassChange: (value: string) => void;
  onLayoutChange: (type: "rows" | "columns", value: number) => void;
};

export function TeacherSeatingStrategyCard({
  classes,
  classId,
  draftSummary,
  aiOptions,
  keepLockedSeats,
  lockedSeats,
  layoutRows,
  layoutColumns,
  studentsCount,
  lastLoadedAt,
  studentMap,
  pageError,
  saveError,
  saveMessage,
  refreshing,
  previewing,
  saving,
  hasPreviewPlan,
  hasSavedPlan,
  setAiOptions,
  onKeepLockedSeatsChange,
  onRefresh,
  onGeneratePreview,
  onApplyPreview,
  onRestoreSaved,
  onSavePlan,
  onClassChange,
  onLayoutChange
}: TeacherSeatingStrategyCardProps) {
  return (
    <Card title="班级与学期排座策略" tag="学期">
      <div className="feature-card">
        <EduIcon name="brain" />
        <p>选择班级、调整座位布局后即可生成学期预览；建议先定一版正式方案，后续只在必要时做局部调整。</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
        <label>
          <div className="section-title">班级</div>
          <select
            value={classId}
            onChange={(event) => onClassChange(event.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.grade}年级 · {item.subject}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">排数</div>
          <select
            value={layoutRows}
            onChange={(event) => onLayoutChange("rows", Number(event.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            {LAYOUT_OPTIONS.map((value) => (
              <option key={`rows-${value}`} value={value}>
                {value} 排
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">列数</div>
          <select
            value={layoutColumns}
            onChange={(event) => onLayoutChange("columns", Number(event.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            {LAYOUT_OPTIONS.map((value) => (
              <option key={`columns-${value}`} value={value}>
                {value} 列
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <label className="card" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={aiOptions.pairByScoreComplement}
            onChange={(event) => setAiOptions((prev) => ({ ...prev, pairByScoreComplement: event.target.checked }))}
            style={{ marginRight: 8 }}
          />
          成绩互补优先
        </label>
        <label className="card" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={aiOptions.balanceGender}
            onChange={(event) => setAiOptions((prev) => ({ ...prev, balanceGender: event.target.checked }))}
            style={{ marginRight: 8 }}
          />
          性别平衡优先
        </label>
        <label className="card" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={aiOptions.respectHeightGradient}
            onChange={(event) => setAiOptions((prev) => ({ ...prev, respectHeightGradient: event.target.checked }))}
            style={{ marginRight: 8 }}
          />
          身高梯度优先
        </label>
        <label className="card" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={keepLockedSeats}
            onChange={(event) => onKeepLockedSeatsChange(event.target.checked)}
            style={{ marginRight: 8 }}
          />
          保留锁定座位
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
        <div className="card">
          <div className="section-title">班级学生</div>
          <p>{studentsCount} 人</p>
        </div>
        <div className="card">
          <div className="section-title">当前容量</div>
          <p>{draftSummary?.seatCapacity ?? layoutRows * layoutColumns} 个座位</p>
        </div>
        <div className="card">
          <div className="section-title">资料待补</div>
          <p>{draftSummary?.lowCompletenessCount ?? 0} 人</p>
        </div>
        <div className="card">
          <div className="section-title">最近同步</div>
          <p>{formatLoadedTime(lastLoadedAt) || "刚刚"}</p>
        </div>
        <div className="card">
          <div className="section-title">已锁定位</div>
          <p>{lockedSeats.length} 个</p>
        </div>
      </div>

      {lockedSeats.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {lockedSeats.map((seat) => {
            const student = studentMap.get(seat.studentId);
            return (
              <span key={`locked-${seat.seatId}`} className="badge">
                锁定：第 {seat.row} 排第 {seat.column} 列 · {getStudentDisplayName(student)}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          先在下方草稿里锁定本学期必须保留的关键座位，再生成学期预览，系统会只重排其余位置。
        </div>
      )}

      {pageError ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{pageError}</div> : null}
      {saveError ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{saveError}</div> : null}
      {saveMessage ? <div style={{ color: "#027a48", fontSize: 13, marginTop: 12 }}>{saveMessage}</div> : null}

      <div className="cta-row" style={{ marginTop: 12 }}>
        <button className="button ghost" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "刷新中..." : "刷新数据"}
        </button>
        <button className="button secondary" type="button" onClick={onGeneratePreview} disabled={previewing}>
          {previewing ? "生成中..." : "生成学期预览"}
        </button>
        <button className="button ghost" type="button" onClick={onApplyPreview} disabled={!hasPreviewPlan}>
          应用学期预览
        </button>
        <button className="button ghost" type="button" onClick={onRestoreSaved} disabled={!hasSavedPlan}>
          恢复已保存版本
        </button>
        <button className="button primary" type="button" onClick={onSavePlan} disabled={saving}>
          {saving ? "保存中..." : "保存本学期方案"}
        </button>
      </div>
    </Card>
  );
}
