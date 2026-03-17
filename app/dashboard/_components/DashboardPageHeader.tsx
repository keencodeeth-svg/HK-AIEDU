type DashboardPageHeaderProps = {
  roleLabel: string;
};

export default function DashboardPageHeader({ roleLabel }: DashboardPageHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>总看板</h2>
        <div className="section-sub">按身份汇总提醒、任务、沟通与最值得先做的动作。</div>
      </div>
      <span className="chip">{roleLabel}工作台</span>
    </div>
  );
}
