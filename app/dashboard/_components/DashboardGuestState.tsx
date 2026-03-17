import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";

export default function DashboardGuestState() {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习看板</h2>
          <div className="section-sub">请先登录，再查看你的专属工作台。</div>
        </div>
        <span className="chip">Dashboard</span>
      </div>
      <Card title="登录后查看总看板" tag="登录">
        <StatePanel
          tone="info"
          title="登录后查看你的专属工作台"
          description="系统会根据身份展示最值得先做的任务、提醒和快捷入口。"
          action={
            <Link className="button primary" href="/login">
              去登录
            </Link>
          }
        />
      </Card>
    </div>
  );
}
