import type { ComponentProps } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { FavoriteItem } from "../types";
import StudentFavoriteCompactCard from "./StudentFavoriteCompactCard";
import StudentFavoriteDetailedCard from "./StudentFavoriteDetailedCard";
import StudentFavoriteEditorCard from "./StudentFavoriteEditorCard";

type StudentFavoritesListProps = {
  viewMode: "compact" | "detailed";
  filteredFavorites: FavoriteItem[];
  visibleFavorites: FavoriteItem[];
  hasActiveFilters: boolean;
  showAll: boolean;
  editingQuestionId: string;
  removingQuestionId: string;
  savingQuestionId: string;
  draftTags: string;
  draftNote: string;
  editorRef: ComponentProps<typeof StudentFavoriteEditorCard>["editorRef"];
  onEdit: (item: FavoriteItem) => void;
  onCopy: (item: FavoriteItem) => void;
  onRemove: (item: FavoriteItem) => void;
  onDraftTagsChange: (value: string) => void;
  onDraftNoteChange: (value: string) => void;
  onSave: (item: FavoriteItem) => void;
  onCancelEdit: () => void;
  onClearFilters: () => void;
  onToggleShowAll: () => void;
};

export default function StudentFavoritesList({
  viewMode,
  filteredFavorites,
  visibleFavorites,
  hasActiveFilters,
  showAll,
  editingQuestionId,
  removingQuestionId,
  savingQuestionId,
  draftTags,
  draftNote,
  editorRef,
  onEdit,
  onCopy,
  onRemove,
  onDraftTagsChange,
  onDraftNoteChange,
  onSave,
  onCancelEdit,
  onClearFilters,
  onToggleShowAll
}: StudentFavoritesListProps) {
  return (
    <Card title="我的收藏" tag="清单">
      {!filteredFavorites.length ? (
        <StatePanel
          compact
          tone="empty"
          title={hasActiveFilters ? "当前筛选条件下暂无收藏" : "还没有收藏题目"}
          description={hasActiveFilters ? "可以清空筛选后查看全部收藏。" : "先在练习、考试或 AI 辅导中收藏题目，这里会自动沉淀。"}
          action={
            hasActiveFilters ? (
              <button className="button secondary" type="button" onClick={onClearFilters}>
                清空筛选
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid" style={{ gap: viewMode === "compact" ? 10 : 12 }}>
          {visibleFavorites.map((item) => {
            const editor =
              editingQuestionId === item.questionId ? (
                <StudentFavoriteEditorCard
                  draftTags={draftTags}
                  draftNote={draftNote}
                  saving={savingQuestionId === item.questionId}
                  editorRef={editorRef}
                  onDraftTagsChange={onDraftTagsChange}
                  onDraftNoteChange={onDraftNoteChange}
                  onSave={() => onSave(item)}
                  onCancel={onCancelEdit}
                />
              ) : null;

            if (viewMode === "compact") {
              return (
                <StudentFavoriteCompactCard
                  key={item.id}
                  item={item}
                  isEditing={editingQuestionId === item.questionId}
                  isRemoving={removingQuestionId === item.questionId}
                  onEdit={() => onEdit(item)}
                  onCopy={() => onCopy(item)}
                  onRemove={() => onRemove(item)}
                  editor={editor}
                />
              );
            }

            return (
              <StudentFavoriteDetailedCard
                key={item.id}
                item={item}
                isEditing={editingQuestionId === item.questionId}
                isRemoving={removingQuestionId === item.questionId}
                onEdit={() => onEdit(item)}
                onCopy={() => onCopy(item)}
                onRemove={() => onRemove(item)}
                editor={editor}
              />
            );
          })}
        </div>
      )}

      {filteredFavorites.length > 12 ? (
        <div className="cta-row favorites-load-more">
          <button className="button ghost" type="button" onClick={onToggleShowAll}>
            {showAll ? "收起结果" : `展开全部（${filteredFavorites.length}）`}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
