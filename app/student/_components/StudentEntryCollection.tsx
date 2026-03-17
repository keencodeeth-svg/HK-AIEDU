"use client";

import type { FormEvent } from "react";
import StudentEntryCompactCard from "./StudentEntryCompactCard";
import StudentEntryDetailCard from "./StudentEntryDetailCard";
import type { EntryCategory, EntryItem, EntryViewMode, JoinMessage } from "../types";
import { CATEGORY_META, ENTRY_CATEGORIES } from "../utils";

type StudentEntryCollectionProps = {
  activeCategory: EntryCategory;
  categoryCounts: Record<EntryCategory, number>;
  showAllEntries: boolean;
  entryViewMode: EntryViewMode;
  entriesByCategoryCount: number;
  visibleEntries: EntryItem[];
  joinCode: string;
  joinMessage: JoinMessage | null;
  pendingJoinCount: number;
  onCategoryChange: (category: EntryCategory) => void;
  onToggleShowAllEntries: () => void;
  onEntryViewModeChange: (mode: EntryViewMode) => void;
  onJoinClass: (event: FormEvent<HTMLFormElement>) => void;
  onJoinCodeChange: (value: string) => void;
};

export default function StudentEntryCollection({
  activeCategory,
  categoryCounts,
  showAllEntries,
  entryViewMode,
  entriesByCategoryCount,
  visibleEntries,
  joinCode,
  joinMessage,
  pendingJoinCount,
  onCategoryChange,
  onToggleShowAllEntries,
  onEntryViewModeChange,
  onJoinClass,
  onJoinCodeChange
}: StudentEntryCollectionProps) {
  return (
    <>
      <div className="student-entry-toolbar">
        <div className="student-entry-filter-group" role="toolbar" aria-label="切换学习入口分类">
          {ENTRY_CATEGORIES.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "button secondary" : "button ghost"}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => onCategoryChange(category)}
            >
              {CATEGORY_META[category].label} ({categoryCounts[category]})
            </button>
          ))}
        </div>
        <div className="student-entry-view-group" role="toolbar" aria-label="切换学习入口显示方式">
          <button
            className={showAllEntries ? "button secondary" : "button ghost"}
            type="button"
            aria-pressed={showAllEntries}
            onClick={onToggleShowAllEntries}
          >
            {showAllEntries ? "收起入口" : `展开全部（${entriesByCategoryCount}）`}
          </button>
          <button
            className={entryViewMode === "compact" ? "button secondary" : "button ghost"}
            type="button"
            aria-pressed={entryViewMode === "compact"}
            onClick={() => onEntryViewModeChange("compact")}
          >
            紧凑视图
          </button>
          <button
            className={entryViewMode === "detailed" ? "button secondary" : "button ghost"}
            type="button"
            aria-pressed={entryViewMode === "detailed"}
            onClick={() => onEntryViewModeChange("detailed")}
          >
            详细视图
          </button>
        </div>
      </div>

      {entryViewMode === "detailed" ? (
        <div className="grid grid-3">
          {visibleEntries.map((item) => (
            <StudentEntryDetailCard
              key={item.id}
              item={item}
              joinCode={joinCode}
              joinMessage={joinMessage}
              pendingJoinCount={pendingJoinCount}
              onJoinClass={onJoinClass}
              onJoinCodeChange={onJoinCodeChange}
            />
          ))}
        </div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {visibleEntries.map((item) => (
            <StudentEntryCompactCard
              key={item.id}
              item={item}
              joinCode={joinCode}
              joinMessage={joinMessage}
              onJoinClass={onJoinClass}
              onJoinCodeChange={onJoinCodeChange}
            />
          ))}
        </div>
      )}
    </>
  );
}
