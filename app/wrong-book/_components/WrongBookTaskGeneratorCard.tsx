import Card from "@/components/Card";
import MathText from "@/components/MathText";
import type { WrongBookItem } from "../types";
import { formatDateTime } from "../utils";

type WrongBookTaskGeneratorCardProps = {
  dueDate: string;
  list: WrongBookItem[];
  selected: Record<string, boolean>;
  message: string | null;
  errors: string[];
  submitting: boolean;
  onDueDateChange: (value: string) => void;
  onToggleSelect: (id: string) => void;
  onCreateTasks: () => void | Promise<void>;
};

export default function WrongBookTaskGeneratorCard({
  dueDate,
  list,
  selected,
  message,
  errors,
  submitting,
  onDueDateChange,
  onToggleSelect,
  onCreateTasks
}: WrongBookTaskGeneratorCardProps) {
  return (
    <Card title="从错题生成订正任务" tag="生成">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          <div className="section-title">截止日期</div>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => onDueDateChange(event.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          />
        </label>
        <div className="grid" style={{ gap: 12 }}>
          {list.length === 0 ? <p>暂无错题，继续保持！</p> : null}
          {list.map((item) => (
            <div className="card" key={item.id}>
              <label style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={Boolean(selected[item.id])}
                  onChange={() => onToggleSelect(item.id)}
                  style={{ marginTop: 6 }}
                />
                <div>
                  <div className="section-title">
                    <MathText text={item.stem} />
                  </div>
                  <MathText as="p" text={item.explanation} />
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    {item.nextReviewAt ? `下次复练：${formatDateTime(item.nextReviewAt)} · ` : ""}
                    {item.intervalLabel ? `阶段：${item.intervalLabel} · ` : ""}
                    {item.weaknessRank ? `薄弱排序：#${item.weaknessRank}` : ""}
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>
        <button className="button primary" type="button" onClick={onCreateTasks} disabled={submitting}>
          {submitting ? "创建中..." : "创建订正任务"}
        </button>
        {message ? <div>{message}</div> : null}
        {errors.length ? (
          <div style={{ color: "#b42318", fontSize: 13 }}>
            {errors.slice(0, 5).map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
