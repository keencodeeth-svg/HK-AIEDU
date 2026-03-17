import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { FormState, ScheduleStatus } from "../types";

type ExamCreateScheduleCardProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  scheduleStatus: ScheduleStatus;
};

export default function ExamCreateScheduleCard({ form, setForm, scheduleStatus }: ExamCreateScheduleCardProps) {
  return (
    <Card title="3. 时间与监测" tag="Schedule">
      <div className="teacher-exam-create-section-grid">
        <label>
          <div className="section-title">开始时间（可选）</div>
          <input type="datetime-local" value={form.startAt} onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))} />
        </label>

        <label>
          <div className="section-title">截止时间</div>
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
            required
          />
        </label>

        <label>
          <div className="section-title">考试时长（分钟）</div>
          <input
            type="number"
            min={5}
            max={300}
            value={form.durationMinutes}
            onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: Math.max(5, Number(event.target.value || 60)) }))}
          />
        </label>

        <label>
          <div className="section-title">防作弊等级</div>
          <select
            value={form.antiCheatLevel}
            onChange={(event) => setForm((prev) => ({ ...prev, antiCheatLevel: event.target.value as FormState["antiCheatLevel"] }))}
          >
            <option value="basic">基础监测（记录切屏/离屏）</option>
            <option value="off">关闭</option>
          </select>
        </label>
      </div>

      <StatePanel compact tone={scheduleStatus.tone} title={scheduleStatus.title} description={scheduleStatus.description} />
    </Card>
  );
}
