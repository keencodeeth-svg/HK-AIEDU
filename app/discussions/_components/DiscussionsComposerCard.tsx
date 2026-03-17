import type { FormEvent } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import type { ClassItem } from "../types";

type DiscussionsComposerCardProps = {
  classes: ClassItem[];
  classId: string;
  title: string;
  content: string;
  pinned: boolean;
  creating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onPinnedChange: (checked: boolean) => void;
};

export default function DiscussionsComposerCard({
  classes,
  classId,
  title,
  content,
  pinned,
  creating,
  onSubmit,
  onTitleChange,
  onContentChange,
  onPinnedChange
}: DiscussionsComposerCardProps) {
  return (
    <Card title="发布新话题" tag="教师">
      <div className="feature-card">
        <EduIcon name="pencil" />
        <p>用明确问题、课堂任务或复盘要求发起讨论，能显著提升学生参与度和回复质量。</p>
      </div>
      {!classes.length ? (
        <StatePanel compact tone="info" title="当前没有可发布的班级" description="创建或接入授课班级后，即可在这里发起课堂讨论。" />
      ) : (
        <form onSubmit={onSubmit} className="inbox-compose-form">
          <label>
            <div className="section-title">话题标题</div>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="workflow-search-input"
              placeholder="例如：这道题你会先从哪一步入手？"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <div className="section-title">话题内容</div>
            <textarea
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              rows={4}
              className="inbox-textarea"
              placeholder="补充讨论背景、题目说明或回复要求，让学生更容易高质量参与。"
            />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="checkbox" checked={pinned} onChange={(event) => onPinnedChange(event.target.checked)} />
            <span>置顶话题</span>
            <span className="form-note">置顶后会优先展示在列表顶部，适合课堂重点问题或本周必参与讨论。</span>
          </label>
          <div className="cta-row no-margin">
            <button className="button primary" type="submit" disabled={creating || !classId || !title.trim() || !content.trim()}>
              {creating ? "发布中..." : "发布话题"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
