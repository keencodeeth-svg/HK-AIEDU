"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";

type PlanItem = {
  knowledgePointId: string;
  targetCount: number;
  dueDate: string;
  subject?: string;
  masteryScore?: number;
  masteryLevel?: "weak" | "developing" | "strong";
};

export default function StudentPage() {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [motivation, setMotivation] = useState<{ streak: number; badges: any[]; weekly: any } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => res.json())
      .then((data) => {
        const items = data.data?.items ?? [];
        setPlan(items);
      });
    fetch("/api/student/motivation")
      .then((res) => res.json())
      .then((data) => setMotivation(data));
    fetch("/api/student/join-requests")
      .then((res) => res.json())
      .then((data) => setJoinRequests(data.data ?? []));
  }, []);

  async function handleJoinClass(event: React.FormEvent) {
    event.preventDefault();
    setJoinMessage(null);
    const res = await fetch("/api/student/join-class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode })
    });
    const data = await res.json();
    setJoinMessage(data?.message ?? (res.ok ? "已提交" : "加入失败"));
    setJoinCode("");
    fetch("/api/student/join-requests")
      .then((resp) => resp.json())
      .then((payload) => setJoinRequests(payload.data ?? []));
  }

  async function refreshPlan() {
    setRefreshing(true);
    const res = await fetch("/api/plan/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "all" })
    });
    const data = await res.json();
    const items = data?.data?.items ?? data?.data?.plan?.items ?? [];
    if (Array.isArray(items)) {
      setPlan(items);
    }
    setRefreshing(false);
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习控制台</h2>
          <div className="section-sub">今日任务、成长激励与学习入口。</div>
        </div>
        <span className="chip">学期进行中</span>
      </div>

      <Card title="今日任务" tag="计划">
        {plan.length === 0 ? (
          <p>尚未生成学习计划，请先完成诊断测评。</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {plan.slice(0, 3).map((item) => (
              <li key={item.knowledgePointId}>
                {item.subject ? `【${SUBJECT_LABELS[item.subject] ?? item.subject}】` : ""}练习 {item.targetCount} 题，截止{" "}
                {new Date(item.dueDate).toLocaleDateString("zh-CN")}
                {typeof item.masteryScore === "number" ? `，当前掌握 ${item.masteryScore} 分` : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button secondary" onClick={refreshPlan}>
            {refreshing ? "刷新中..." : "刷新学习计划"}
          </button>
        </div>
      </Card>

      <Card title="学习激励" tag="成长">
        <div className="grid grid-2">
          <div className="card">
            <div className="section-title">连续学习</div>
            <p>{motivation?.streak ?? 0} 天</p>
          </div>
          <div className="card">
            <div className="section-title">本周正确率</div>
            <p>{motivation?.weekly?.accuracy ?? 0}%</p>
          </div>
        </div>
        <div className="grid" style={{ gap: 8, marginTop: 12 }}>
          <div className="badge">徽章</div>
          {motivation?.badges?.length ? (
            motivation.badges.map((badge: any) => (
              <div key={badge.id}>
                {badge.title} - {badge.description}
              </div>
            ))
          ) : (
            <p>完成一次练习即可获得首枚徽章。</p>
          )}
        </div>
      </Card>

      <div className="section-head">
        <div>
          <h2>学习入口</h2>
          <div className="section-sub">诊断、作业、AI 辅导与家校协作。</div>
        </div>
      </div>

      <div className="grid grid-3">
        <Card title="诊断测评" tag="起步">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>定位薄弱点，生成学习计划。</p>
          </div>
          <Link className="button secondary" href="/diagnostic" style={{ marginTop: 12 }}>
            开始诊断
          </Link>
        </Card>
        <Card title="加入班级" tag="班级">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>输入老师提供的邀请码加入班级。</p>
          </div>
          <form onSubmit={handleJoinClass} style={{ display: "grid", gap: 10 }}>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="输入老师提供的邀请码"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
            <button className="button primary" type="submit">
              提交申请
            </button>
          </form>
          {joinMessage ? <div style={{ marginTop: 8, fontSize: 12 }}>{joinMessage}</div> : null}
          {joinRequests.filter((item) => item.status === "pending").length ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>已有待审核申请。</div>
          ) : null}
        </Card>
        <Card title="作业中心" tag="作业">
          <div className="feature-card">
            <EduIcon name="pencil" />
            <p>查看老师布置的作业进度。</p>
          </div>
          <Link className="button secondary" href="/student/assignments" style={{ marginTop: 12 }}>
            进入作业
          </Link>
        </Card>
        <Card title="课程模块" tag="路径">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>按单元查看学习内容与作业。</p>
          </div>
          <Link className="button secondary" href="/student/modules" style={{ marginTop: 12 }}>
            查看模块
          </Link>
        </Card>
        <Card title="AI 辅导" tag="智能">
          <div className="feature-card">
            <EduIcon name="brain" />
            <p>逐步提示和引导式讲解。</p>
          </div>
          <Link className="button secondary" href="/tutor" style={{ marginTop: 12 }}>
            打开辅导
          </Link>
        </Card>
        <Card title="学习陪练" tag="陪伴">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>分步提示 + 卡点追问。</p>
          </div>
          <Link className="button secondary" href="/coach" style={{ marginTop: 12 }}>
            进入陪练
          </Link>
        </Card>
        <Card title="朗读评分" tag="语感">
          <div className="feature-card">
            <EduIcon name="rocket" />
            <p>语文/英语朗读跟读评分。</p>
          </div>
          <Link className="button secondary" href="/reading" style={{ marginTop: 12 }}>
            开始朗读
          </Link>
        </Card>
        <Card title="专注计时" tag="专注">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>番茄钟专注训练 + 休息建议。</p>
          </div>
          <Link className="button secondary" href="/focus" style={{ marginTop: 12 }}>
            开启专注
          </Link>
        </Card>
        <Card title="题目收藏夹" tag="收藏">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>收藏题目并添加标签，便于复习。</p>
          </div>
          <Link className="button secondary" href="/student/favorites" style={{ marginTop: 12 }}>
            查看收藏
          </Link>
        </Card>
        <Card title="记忆曲线复习" tag="复习">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>按遗忘曲线自动安排复习。</p>
          </div>
          <Link className="button secondary" href="/practice?mode=review" style={{ marginTop: 12 }}>
            开始复习
          </Link>
        </Card>
        <Card title="学习画像" tag="数据">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>查看能力雷达与掌握度。</p>
          </div>
          <Link className="button secondary" href="/student/portrait" style={{ marginTop: 12 }}>
            查看画像
          </Link>
        </Card>
        <Card title="作业批改" tag="表达">
          <div className="feature-card">
            <EduIcon name="pencil" />
            <p>作文/主观题与作业上传统一批改入口。</p>
          </div>
          <Link className="button secondary" href="/student/assignments" style={{ marginTop: 12 }}>
            进入作业中心
          </Link>
        </Card>
        <Card title="挑战任务" tag="成长">
          <div className="feature-card">
            <EduIcon name="trophy" />
            <p>闯关挑战，解锁奖励。</p>
          </div>
          <Link className="button secondary" href="/challenge" style={{ marginTop: 12 }}>
            进入挑战
          </Link>
        </Card>
        <Card title="错题本" tag="提升">
          <div className="feature-card">
            <EduIcon name="puzzle" />
            <p>查看错因与复习节奏。</p>
          </div>
          <Link className="button secondary" href="/wrong-book" style={{ marginTop: 12 }}>
            进入错题本
          </Link>
        </Card>
        <Card title="通知中心" tag="提醒">
          <div className="feature-card">
            <EduIcon name="rocket" />
            <p>查看最新作业与班级通知。</p>
          </div>
          <Link className="button secondary" href="/notifications" style={{ marginTop: 12 }}>
            查看通知
          </Link>
        </Card>
      </div>

      <Card title="学习报告" tag="分析">
        <p>查看本周学习进度与薄弱点。</p>
        <Link className="button secondary" href="/report" style={{ marginTop: 12 }}>
          查看报告
        </Link>
      </Card>

      <Card title="成长档案" tag="成长">
        <p>沉淀学习路径与掌握度变化。</p>
        <Link className="button secondary" href="/student/growth" style={{ marginTop: 12 }}>
          查看档案
        </Link>
      </Card>

      <Card title="学生资料" tag="设置">
        <p>设置年级、学科与学习目标。</p>
        <Link className="button secondary" href="/student/profile" style={{ marginTop: 12 }}>
          进入设置
        </Link>
      </Card>
    </div>
  );
}
