import type { FormEventHandler } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem } from "../types";
import { getComposeHint } from "../utils";

type InboxComposerCardProps = {
  role: string | null;
  classes: ClassItem[];
  classId: string;
  subject: string;
  content: string;
  includeParents: boolean;
  currentClass: ClassItem | null;
  message: string | null;
  error: string | null;
  actionLoading: boolean;
  onClassChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onIncludeParentsChange: (value: boolean) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export default function InboxComposerCard({
  role,
  classes,
  classId,
  subject,
  content,
  includeParents,
  currentClass,
  message,
  error,
  actionLoading,
  onClassChange,
  onSubjectChange,
  onContentChange,
  onIncludeParentsChange,
  onSubmit
}: InboxComposerCardProps) {
  return (
    <Card title="发送新消息" tag="新建">
      <div className="feature-card">
        <EduIcon name="board" />
        <p>{getComposeHint(role)}</p>
      </div>
      {!classes.length ? (
        <StatePanel
          compact
          tone="info"
          title="当前没有可发信的班级"
          description="加入班级或建立教学关系后，这里会自动开放按班级沟通能力。"
        />
      ) : (
        <form onSubmit={onSubmit} className="inbox-compose-form">
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={classId}
              onChange={(event) => onClassChange(event.target.value)}
              className="select-control"
              style={{ width: "100%" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">主题</div>
            <input
              value={subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              className="workflow-search-input"
              placeholder="例如：本周作业安排、请假说明、课堂反馈"
            />
          </label>
          <label>
            <div className="section-title">内容</div>
            <textarea
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              rows={4}
              className="inbox-textarea"
              placeholder="输入要发送的消息内容..."
            />
          </label>
          {role === "teacher" ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={includeParents}
                onChange={(event) => onIncludeParentsChange(event.target.checked)}
              />
              同时抄送家长
            </label>
          ) : null}
          <div className="workflow-card-meta">
            {currentClass ? (
              <span className="pill">
                发送给：{currentClass.name} · {SUBJECT_LABELS[currentClass.subject] ?? currentClass.subject}
              </span>
            ) : null}
            {role === "teacher" ? (
              <span className="pill">教师可按班级群发</span>
            ) : (
              <span className="pill">学生/家长会发送给任课老师</span>
            )}
          </div>
          {error ? <div className="status-note error">{error}</div> : null}
          {message ? <div className="status-note success">{message}</div> : null}
          <button
            className="button primary"
            type="submit"
            disabled={actionLoading || !subject.trim() || !content.trim() || !classId}
          >
            {actionLoading ? "发送中..." : "发送消息"}
          </button>
        </form>
      )}
    </Card>
  );
}
