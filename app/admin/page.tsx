import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import AnalyticsFunnelCard from "@/components/AnalyticsFunnelCard";
import ObservabilityMetricsCard from "@/components/ObservabilityMetricsCard";

export default function AdminPage() {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>管理控制台</h2>
          <div className="section-sub">题库、知识点树与平台运营总览。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      <div className="grid grid-2">
        <Card title="教材课件管理" tag="资料">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>导入教材、上传课件/教案、执行全学科批量导入。</p>
          </div>
          <Link className="button secondary" href="/library" style={{ marginTop: 12 }}>
            进入资料库
          </Link>
        </Card>
        <Card title="题库管理" tag="题库">
          <div className="feature-card">
            <EduIcon name="pencil" />
            <p>维护题库、解析与难度标签。</p>
          </div>
          <Link className="button secondary" href="/admin/questions" style={{ marginTop: 12 }}>
            进入题库
          </Link>
        </Card>
        <Card title="知识点树" tag="大纲">
          <div className="feature-card">
            <EduIcon name="book" />
          <p>K12 学科：学科 → 年级 → 单元 → 知识点。</p>
          </div>
          <div className="cta-row">
            <Link className="button secondary" href="/admin/knowledge-points">
              管理知识点
            </Link>
            <Link className="button ghost" href="/admin/knowledge-tree">
              查看知识点树
            </Link>
          </div>
        </Card>
        <Card title="学生概览" tag="运营">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>学习漏斗（登录→练习→提交→周报）。</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <AnalyticsFunnelCard />
          </div>
        </Card>
        <Card title="操作日志" tag="安全">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>查看管理员操作记录与关键变更。</p>
          </div>
          <Link className="button secondary" href="/admin/logs" style={{ marginTop: 12 }}>
            查看日志
          </Link>
        </Card>
        <Card title="A/B 与灰度" tag="发布">
          <div className="feature-card">
            <EduIcon name="rocket" />
            <p>实验分组效果、阈值调优与灰度发布开关。</p>
          </div>
          <Link className="button secondary" href="/admin/experiments" style={{ marginTop: 12 }}>
            打开实验中心
          </Link>
        </Card>
        <Card title="AI 模型路由" tag="AI">
          <div className="feature-card">
            <EduIcon name="brain" />
            <p>配置模型主备链、任务级策略、连通性测试与调用指标。</p>
          </div>
          <Link className="button secondary" href="/admin/ai-models" style={{ marginTop: 12 }}>
            打开模型中心
          </Link>
        </Card>
        <Card title="接口可观测性" tag="运维">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>请求量、错误率与慢接口趋势。</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <ObservabilityMetricsCard />
          </div>
        </Card>
      </div>
    </div>
  );
}
