export function ReportHeader({ chipLabel }: { chipLabel: string }) {
  return (
    <div className="section-head">
      <div>
        <h2>学习报告</h2>
        <div className="section-sub">学习数据与薄弱点复盘。</div>
      </div>
      <span className="chip">{chipLabel}</span>
    </div>
  );
}
