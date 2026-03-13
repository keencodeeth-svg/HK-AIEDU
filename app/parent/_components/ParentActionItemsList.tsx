import type { ParentActionItem, ReceiptSource, ReceiptStatus } from "../types";

type ParentActionItemsListProps = {
  source: ReceiptSource;
  items: ParentActionItem[];
  receiptNotes: Record<string, string>;
  receiptLoadingKey: string | null;
  error: string | null;
  notePlaceholder: string;
  emptyText: string;
  showParentTip?: boolean;
  onNoteChange: (key: string, value: string) => void;
  onSubmitReceipt: (source: ReceiptSource, item: ParentActionItem, status: ReceiptStatus) => void | Promise<void>;
};

export default function ParentActionItemsList({
  source,
  items,
  receiptNotes,
  receiptLoadingKey,
  error,
  notePlaceholder,
  emptyText,
  showParentTip,
  onNoteChange,
  onSubmitReceipt
}: ParentActionItemsListProps) {
  if (!items.length) {
    return <p>{emptyText}</p>;
  }

  return (
    <>
      {error ? <div style={{ marginTop: 8, fontSize: 12, color: "#b42318" }}>{error}</div> : null}
      <div className="grid" style={{ gap: 8, marginTop: 8 }}>
        {items.map((item) => {
          const key = `${source}:${item.id}`;
          return (
            <div className="card" key={item.id} data-testid={`parent-action-item-${source}-${item.id}`}>
              <div className="section-title">{item.title}</div>
              <p>{item.description}</p>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>建议时长：{item.estimatedMinutes ?? 0} 分钟</div>
              {showParentTip && item.parentTip ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>家长提示：{item.parentTip}</div>
              ) : null}
              <div
                style={{ fontSize: 12, color: "var(--ink-1)" }}
                data-testid={`parent-action-status-${source}-${item.id}`}
              >
                执行状态：
                {item.receipt?.status === "done" ? "已打卡" : item.receipt?.status === "skipped" ? "已跳过" : "未打卡"}
                {item.receipt?.completedAt ? ` · ${new Date(item.receipt.completedAt).toLocaleString("zh-CN")}` : ""}
              </div>
              {typeof item.receipt?.effectScore === "number" ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>本次效果分：{item.receipt.effectScore}</div>
              ) : null}
              <label style={{ marginTop: 8, display: "block" }}>
                <div style={{ fontSize: 12, color: "var(--ink-1)", marginBottom: 4 }}>备注/跳过原因（可选）</div>
                <input
                  value={receiptNotes[key] ?? item.receipt?.note ?? ""}
                  onChange={(event) => onNoteChange(key, event.target.value)}
                  placeholder={notePlaceholder}
                  data-testid={`parent-action-note-${source}-${item.id}`}
                  style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <div className="cta-row" style={{ marginTop: 8 }}>
                <button
                  className="button ghost"
                  type="button"
                  disabled={receiptLoadingKey === key}
                  data-testid={`parent-action-done-${source}-${item.id}`}
                  onClick={() => onSubmitReceipt(source, item, "done")}
                >
                  {receiptLoadingKey === key ? "打卡中..." : "执行打卡"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={receiptLoadingKey === key}
                  data-testid={`parent-action-skip-${source}-${item.id}`}
                  onClick={() => onSubmitReceipt(source, item, "skipped")}
                >
                  {receiptLoadingKey === key ? "提交中..." : "暂时跳过"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
