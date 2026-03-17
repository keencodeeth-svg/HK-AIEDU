import type { ReactNode } from "react";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import { formatLoadedTime } from "@/lib/client-request";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { FavoriteItem } from "../types";

type StudentFavoriteDetailedCardProps = {
  item: FavoriteItem;
  isEditing: boolean;
  isRemoving: boolean;
  editor: ReactNode;
  onEdit: () => void;
  onCopy: () => void;
  onRemove: () => void;
};

export default function StudentFavoriteDetailedCard({
  item,
  isEditing,
  isRemoving,
  editor,
  onEdit,
  onCopy,
  onRemove
}: StudentFavoriteDetailedCardProps) {
  return (
    <div className="card favorites-item-card">
      <div className="feature-card">
        <EduIcon name="book" />
        <div style={{ minWidth: 0 }}>
          <div className="section-title">
            <MathText text={item.question?.stem ?? "题目"} />
          </div>
          <div className="workflow-card-meta" style={{ marginTop: 8 }}>
            <span className="pill">{item.question?.knowledgePointTitle ?? "未关联知识点"}</span>
            <span className="pill">{getGradeLabel(item.question?.grade)}</span>
            <span className="pill">{SUBJECT_LABELS[item.question?.subject ?? ""] ?? item.question?.subject ?? "未分类"}</span>
            <span className="pill">更新于 {formatLoadedTime(item.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="favorites-detail-block">
        <div className="badge">标签</div>
        <div>{item.tags.length ? item.tags.join("、") : "暂未设置标签"}</div>
      </div>

      <div className="favorites-detail-block">
        <div className="badge">复习备注</div>
        <div>{item.note?.trim() ? item.note.trim() : "暂未填写复习备注"}</div>
      </div>

      <div className="cta-row favorites-item-actions">
        <button className="button secondary" type="button" onClick={onEdit}>
          {isEditing ? "继续编辑" : "编辑标签 / 备注"}
        </button>
        <button className="button ghost" type="button" onClick={onCopy}>
          复制题目
        </button>
        <button className="button ghost" type="button" onClick={onRemove} disabled={isRemoving}>
          {isRemoving ? "移除中..." : "取消收藏"}
        </button>
      </div>
      {editor}
    </div>
  );
}
