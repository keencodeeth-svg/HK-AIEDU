import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { LibraryItem, LibrarySubjectGroup, LibraryViewMode } from "../types";
import { contentTypeLabel } from "../utils";

type LibraryListPanelProps = {
  loading: boolean;
  groupedBySubject: LibrarySubjectGroup[];
  expandedSubjects: string[];
  expandedTypeKeys: string[];
  libraryViewMode: LibraryViewMode;
  userRole?: string;
  deletingId: string | null;
  itemsCount: number;
  totalCount: number;
  onSetLibraryViewMode: (mode: LibraryViewMode) => void;
  onSetAllSubjectsExpanded: (expanded: boolean) => void;
  onSetAllTypesExpanded: (expanded: boolean) => void;
  onToggleExpandedSubject: (subject: string) => void;
  onToggleExpandedType: (typeKey: string) => void;
  onDownloadItem: (item: LibraryItem) => void;
  onRemoveItem: (item: LibraryItem) => void;
};

function sourceTypeLabel(item: LibraryItem, textbookLinkBlocked: boolean) {
  if (item.sourceType === "file") return "文件上传";
  if (item.sourceType === "link") return textbookLinkBlocked ? "外部链接（教材禁用）" : "外部链接";
  return "文本录入";
}

function LibraryItemActions({
  item,
  textbookLinkBlocked,
  userRole,
  deletingId,
  onDownloadItem,
  onRemoveItem
}: {
  item: LibraryItem;
  textbookLinkBlocked: boolean;
  userRole?: string;
  deletingId: string | null;
  onDownloadItem: (item: LibraryItem) => void;
  onRemoveItem: (item: LibraryItem) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <Link className="button ghost" href={`/library/${item.id}`}>
        查看
      </Link>
      <button className="button secondary" type="button" onClick={() => onDownloadItem(item)} disabled={textbookLinkBlocked}>
        {textbookLinkBlocked ? "外链禁用" : item.sourceType === "link" ? "打开链接" : "下载"}
      </button>
      {userRole === "admin" ? (
        <button className="button danger" type="button" onClick={() => onRemoveItem(item)} disabled={deletingId === item.id}>
          {deletingId === item.id ? "删除中..." : "删除"}
        </button>
      ) : null}
    </div>
  );
}

function CompactLibraryItemCard({
  item,
  userRole,
  deletingId,
  onDownloadItem,
  onRemoveItem
}: {
  item: LibraryItem;
  userRole?: string;
  deletingId: string | null;
  onDownloadItem: (item: LibraryItem) => void;
  onRemoveItem: (item: LibraryItem) => void;
}) {
  const textbookLinkBlocked = item.contentType === "textbook" && item.sourceType === "link";

  return (
    <div
      key={item.id}
      style={{
        border: "1px solid var(--stroke)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.72)",
        padding: 10
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {item.title}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-1)" }}>
            {item.grade} 年级 · {contentTypeLabel(item.contentType)} · {sourceTypeLabel(item, textbookLinkBlocked)} · {item.generatedByAi ? "AI生成" : "人工上传"}
          </div>
        </div>
        <LibraryItemActions
          item={item}
          textbookLinkBlocked={textbookLinkBlocked}
          userRole={userRole}
          deletingId={deletingId}
          onDownloadItem={onDownloadItem}
          onRemoveItem={onRemoveItem}
        />
      </div>
    </div>
  );
}

function DetailedLibraryItemCard({
  item,
  userRole,
  deletingId,
  onDownloadItem,
  onRemoveItem
}: {
  item: LibraryItem;
  userRole?: string;
  deletingId: string | null;
  onDownloadItem: (item: LibraryItem) => void;
  onRemoveItem: (item: LibraryItem) => void;
}) {
  const textbookLinkBlocked = item.contentType === "textbook" && item.sourceType === "link";

  return (
    <div className="card" key={item.id}>
      <div className="section-title">
        {item.title} <span className="badge">{contentTypeLabel(item.contentType)}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
        {item.grade} 年级 · 来源：{sourceTypeLabel(item, textbookLinkBlocked)} · {item.generatedByAi ? "AI生成" : "人工上传"}
      </div>
      <div className="cta-row" style={{ marginTop: 10 }}>
        <Link className="button ghost" href={`/library/${item.id}`}>
          查看
        </Link>
        <button className="button secondary" type="button" onClick={() => onDownloadItem(item)} disabled={textbookLinkBlocked}>
          {textbookLinkBlocked ? "外链禁用" : item.sourceType === "link" ? "打开链接" : "下载"}
        </button>
        {userRole === "admin" ? (
          <button className="button danger" type="button" onClick={() => onRemoveItem(item)} disabled={deletingId === item.id}>
            {deletingId === item.id ? "删除中..." : "删除"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function LibraryListPanel({
  loading,
  groupedBySubject,
  expandedSubjects,
  expandedTypeKeys,
  libraryViewMode,
  userRole,
  deletingId,
  itemsCount,
  totalCount,
  onSetLibraryViewMode,
  onSetAllSubjectsExpanded,
  onSetAllTypesExpanded,
  onToggleExpandedSubject,
  onToggleExpandedType,
  onDownloadItem,
  onRemoveItem
}: LibraryListPanelProps) {
  const showInitialLoading = loading && itemsCount === 0;
  const showRefreshing = loading && itemsCount > 0;

  return (
    <Card title="资料管理列表" tag="管理">
      <div className="cta-row" style={{ marginTop: 0 }}>
        <span className="badge">视图模式</span>
        <button className={libraryViewMode === "compact" ? "button secondary" : "button ghost"} type="button" onClick={() => onSetLibraryViewMode("compact")}>
          紧凑模式
        </button>
        <button className={libraryViewMode === "detailed" ? "button secondary" : "button ghost"} type="button" onClick={() => onSetLibraryViewMode("detailed")}>
          详细模式
        </button>
        <button className="button ghost" type="button" onClick={() => onSetAllSubjectsExpanded(true)}>
          展开全部学科
        </button>
        <button className="button ghost" type="button" onClick={() => onSetAllSubjectsExpanded(false)}>
          收起全部学科
        </button>
        <button className="button ghost" type="button" onClick={() => onSetAllTypesExpanded(true)}>
          展开全部类型
        </button>
        <button className="button ghost" type="button" onClick={() => onSetAllTypesExpanded(false)}>
          收起全部类型
        </button>
      </div>

      {showInitialLoading ? (
        <div style={{ marginTop: 10 }}>
          <StatePanel tone="loading" title="正在读取资料列表" description="教材、课件与资源分组加载中，请稍候。" />
        </div>
      ) : null}

      {showRefreshing ? (
        <div className="status-note info" style={{ marginTop: 10 }}>
          资料列表刷新中，当前先展示最近一次成功数据。
        </div>
      ) : null}

      {!showInitialLoading ? (
        <div className="grid" style={{ gap: 12, marginTop: 10 }}>
          {!groupedBySubject.length ? (
            <StatePanel
              tone="empty"
              title="暂无资料"
              description="当前筛选条件下没有可展示内容，请调整学科、类型或关键词。"
            />
          ) : (
            groupedBySubject.map((group) => (
              <details key={group.subject} className="card full-span" open={expandedSubjects.includes(group.subject)}>
                <summary
                  onClick={(event) => {
                    event.preventDefault();
                    onToggleExpandedSubject(group.subject);
                  }}
                  style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                >
                  <span className="section-title" style={{ margin: 0 }}>
                    {group.label}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge">{group.list.length} 条</span>
                    <span className="badge">{group.contentGroups.length} 类</span>
                  </div>
                </summary>

                <div className="grid" style={{ gap: 10, marginTop: 10 }}>
                  {group.contentGroups.map((contentGroup) => {
                    const typeKey = `${group.subject}:${contentGroup.contentType}`;
                    return (
                      <details key={typeKey} className="card" open={expandedTypeKeys.includes(typeKey)}>
                        <summary
                          onClick={(event) => {
                            event.preventDefault();
                            onToggleExpandedType(typeKey);
                          }}
                          style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                        >
                          <span className="section-title" style={{ margin: 0 }}>
                            {contentGroup.label}
                          </span>
                          <span className="badge">{contentGroup.list.length} 条</span>
                        </summary>

                        {libraryViewMode === "compact" ? (
                          <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                            {contentGroup.list.map((item) => (
                              <CompactLibraryItemCard
                                key={item.id}
                                item={item}
                                userRole={userRole}
                                deletingId={deletingId}
                                onDownloadItem={onDownloadItem}
                                onRemoveItem={onRemoveItem}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="grid" style={{ gap: 10, marginTop: 10 }}>
                            {contentGroup.list.map((item) => (
                              <DetailedLibraryItemCard
                                key={item.id}
                                item={item}
                                userRole={userRole}
                                deletingId={deletingId}
                                onDownloadItem={onDownloadItem}
                                onRemoveItem={onRemoveItem}
                              />
                            ))}
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              </details>
            ))
          )}
          {groupedBySubject.length ? <div style={{ fontSize: 12, color: "var(--ink-1)" }}>当前页展示 {itemsCount} 条，筛选总量 {totalCount} 条。</div> : null}
        </div>
      ) : null}
    </Card>
  );
}
