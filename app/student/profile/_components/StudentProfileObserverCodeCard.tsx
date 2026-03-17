import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";

type StudentProfileObserverCodeCardProps = {
  observerCode: string;
  observerCopied: boolean;
  observerMessage: string | null;
  observerError: string | null;
  loading: boolean;
  regenerating: boolean;
  onCopy: () => void;
  onReload: () => void;
  onRegenerate: () => void;
};

export default function StudentProfileObserverCodeCard({
  observerCode,
  observerCopied,
  observerMessage,
  observerError,
  loading,
  regenerating,
  onCopy,
  onReload,
  onRegenerate
}: StudentProfileObserverCodeCardProps) {
  const busy = loading || regenerating;

  return (
    <Card title="家长绑定码" tag="家校">
      <div className="feature-card">
        <EduIcon name="rocket" />
        <p>提供给家长注册使用，绑定后可查看学习进展、通知与课堂节奏。</p>
      </div>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <div className="section-title" style={{ fontSize: 18 }}>
          {observerCode || "保存资料后自动生成"}
        </div>
        <button className="button secondary" type="button" disabled={!observerCode || busy} onClick={onCopy}>
          {observerCopied ? "已复制" : "复制绑定码"}
        </button>
        <button className="button secondary" type="button" disabled={busy} onClick={onReload}>
          {loading ? "加载中..." : "重新加载"}
        </button>
        <button className="button ghost" type="button" disabled={busy} onClick={onRegenerate}>
          {regenerating ? "生成中..." : "重新生成"}
        </button>
      </div>
      {observerError ? <div style={{ marginTop: 8, fontSize: 12, color: "#b42318" }}>{observerError}</div> : null}
      {observerMessage ? <div style={{ marginTop: 8, fontSize: 12 }}>{observerMessage}</div> : null}
    </Card>
  );
}
