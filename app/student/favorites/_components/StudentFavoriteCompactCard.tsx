import type { ReactNode } from "react";
import MathText from "@/components/MathText";
import { formatLoadedTime } from "@/lib/client-request";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { FavoriteItem } from "../types";

type StudentFavoriteCompactCardProps = {
  item: FavoriteItem;
  isEditing: boolean;
  isRemoving: boolean;
  editor: ReactNode;
  onEdit: () => void;
  onCopy: () => void;
  onRemove: () => void;
};

export default function StudentFavoriteCompactCard({
  item,
  isEditing,
  isRemoving,
  editor,
  onEdit,
  onCopy,
  onRemove
}: StudentFavoriteCompactCardProps) {
  return (
    <div className="card favorites-item-card">
      <div style={{ minWidth: 0 }}>
        <div className="section-title" style={{ fontSize: 14 }}>
          <MathText text={item.question?.stem ?? "题目"} />
        </div>
        <div className="workflow-card-meta" style={{ marginTop: 8 }}>
          <span className="pill">{SUBJECT_LABELS[item.question?.subject ?? ""] ?? item.question?.subject ?? "未分类"}</span>
          <span className="pill">{getGradeLabel(item.question?.grade)}</span>
          <span className="pill">{item.question?.knowledgePointTitle ?? "未关联知识点"}</span>
          <span className="pill">更新于 {formatLoadedTime(item.updatedAt)}</span>
        </div>
        <div className="favorites-tags-line">
          标签：{item.tags.length ? item.tags.join("、") : "未设置"}
          {item.note?.trim() ? ` · 备注：${item.note.trim()}` : ""}
        </div>
      </div>
      <div className="cta-row favorites-item-actions">
        <button className="button secondary" type="button" onClick={onEdit}>
          {isEditing ? "继续编辑" : "编辑"}
        </button>
        <button className="button ghost" type="button" onClick={onCopy}>
          复制题目
        </button>
        <button className="button ghost" type="button" onClick={onRemove} disabled={isRemoving}>
          {isRemoving ? "移除中..." : "删除"}
        </button>
      </div>
      {editor}
    </div>
  );
}
