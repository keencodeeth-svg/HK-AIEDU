import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { TeacherUnavailableSlot } from "@/lib/teacher-unavailability";
import type { TeacherUnavailableFormState } from "../types";
import { WEEKDAY_OPTIONS, fieldStyle } from "../utils";

type TeacherOption = {
  id: string;
  name: string;
};

type SchoolScheduleTeacherUnavailableCardProps = {
  teacherUnavailableSlots: TeacherUnavailableSlot[];
  teacherUnavailableForm: TeacherUnavailableFormState;
  teacherUnavailableSaving: boolean;
  teacherUnavailableDeletingId: string | null;
  teacherUnavailableMessage: string | null;
  teacherUnavailableError: string | null;
  teacherOptions: TeacherOption[];
  setTeacherUnavailableForm: Dispatch<SetStateAction<TeacherUnavailableFormState>>;
  handleSaveTeacherUnavailable: () => Promise<void>;
  handleDeleteTeacherUnavailable: (id: string) => Promise<void>;
};

export function SchoolScheduleTeacherUnavailableCard({
  teacherUnavailableSlots,
  teacherUnavailableForm,
  teacherUnavailableSaving,
  teacherUnavailableDeletingId,
  teacherUnavailableMessage,
  teacherUnavailableError,
  teacherOptions,
  setTeacherUnavailableForm,
  handleSaveTeacherUnavailable,
  handleDeleteTeacherUnavailable
}: SchoolScheduleTeacherUnavailableCardProps) {
  return (
    <Card title="教师禁排时段" tag="约束">
      <div className="grid" style={{ gap: 12 }}>
        <div id="schedule-unavailability" className="section-sub">配置教师固定禁排窗口，AI 排课和手动新建节次都会自动避开这些时间；教师列表优先取全校教师账号。</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">教师</span>
            <select value={teacherUnavailableForm.teacherId} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, teacherId: event.target.value }))} style={fieldStyle}>
              <option value="">请选择教师</option>
              {teacherOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">星期</span>
            <select value={teacherUnavailableForm.weekday} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, weekday: event.target.value }))} style={fieldStyle}>
              {WEEKDAY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">开始时间</span>
            <input type="time" value={teacherUnavailableForm.startTime} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, startTime: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">结束时间</span>
            <input type="time" value={teacherUnavailableForm.endTime} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, endTime: event.target.value }))} style={fieldStyle} />
          </label>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="section-sub">原因说明</span>
          <input value={teacherUnavailableForm.reason} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="如：教研会 / 固定值班 / 跨校区授课" style={fieldStyle} />
        </label>
        {teacherUnavailableError ? <StatePanel compact tone="error" title="教师禁排保存失败" description={teacherUnavailableError} /> : null}
        {teacherUnavailableMessage ? <StatePanel compact tone="success" title="教师禁排已更新" description={teacherUnavailableMessage} /> : null}
        <div className="cta-row">
          <button className="button primary" type="button" onClick={() => void handleSaveTeacherUnavailable()} disabled={teacherUnavailableSaving}>
            {teacherUnavailableSaving ? "保存中..." : "保存禁排时段"}
          </button>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {teacherUnavailableSlots.map((item) => {
            const teacherName = teacherOptions.find((option) => option.id === item.teacherId)?.name ?? item.teacherId;
            return (
              <div key={item.id} className="card">
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div className="section-title">{teacherName}</div>
                    <div className="meta-text" style={{ marginTop: 6 }}>
                      {WEEKDAY_OPTIONS.find((option) => option.value === String(item.weekday))?.label ?? item.weekday} · {item.startTime}-{item.endTime}
                    </div>
                    {item.reason ? <div className="meta-text" style={{ marginTop: 6 }}>原因：{item.reason}</div> : null}
                  </div>
                  <button className="button ghost" type="button" onClick={() => void handleDeleteTeacherUnavailable(item.id)} disabled={teacherUnavailableDeletingId === item.id}>
                    {teacherUnavailableDeletingId === item.id ? "删除中..." : "删除"}
                  </button>
                </div>
              </div>
            );
          })}
          {!teacherUnavailableSlots.length ? <div className="section-sub">当前未配置教师禁排时段。</div> : null}
        </div>
      </div>
    </Card>
  );
}
