"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import Stat from "@/components/Stat";
import EduIcon from "@/components/EduIcon";

export default function ParentPage() {
  const [report, setReport] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [reminderCopied, setReminderCopied] = useState(false);
  const [assignmentList, setAssignmentList] = useState<any[]>([]);
  const [assignmentSummary, setAssignmentSummary] = useState<any>(null);
  const [assignmentExecution, setAssignmentExecution] = useState<any>(null);
  const [assignmentReminder, setAssignmentReminder] = useState("");
  const [assignmentActionItems, setAssignmentActionItems] = useState<any[]>([]);
  const [assignmentParentTips, setAssignmentParentTips] = useState<string[]>([]);
  const [assignmentEstimatedMinutes, setAssignmentEstimatedMinutes] = useState(0);
  const [assignmentCopied, setAssignmentCopied] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [receiptLoadingKey, setReceiptLoadingKey] = useState<string | null>(null);

  const loadWeekly = useCallback(async () => {
    const res = await fetch("/api/report/weekly");
    const data = await res.json();
    setReport(data);
  }, []);

  const loadAssignments = useCallback(async () => {
    const res = await fetch("/api/parent/assignments");
    const data = await res.json();
    setAssignmentList(data.data ?? []);
    setAssignmentSummary(data.summary ?? null);
    setAssignmentExecution(data.execution ?? null);
    setAssignmentReminder(data.reminderText ?? "");
    setAssignmentActionItems(data.actionItems ?? []);
    setAssignmentParentTips(data.parentTips ?? []);
    setAssignmentEstimatedMinutes(data.estimatedMinutes ?? 0);
  }, []);

  useEffect(() => {
    loadWeekly();
    fetch("/api/corrections")
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.data ?? []);
        setSummary(data.summary ?? null);
      });
    loadAssignments();
    fetch("/api/parent/favorites")
      .then((res) => res.json())
      .then((data) => setFavorites(data.data ?? []));
  }, [loadAssignments, loadWeekly]);

  async function markReceipt(source: "weekly_report" | "assignment_plan", item: any) {
    const key = `${source}:${item.id}`;
    setReceiptLoadingKey(key);
    await fetch("/api/parent/action-items/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        actionItemId: item.id,
        status: "done",
        estimatedMinutes: item.estimatedMinutes ?? 0
      })
    });
    if (source === "weekly_report") {
      await loadWeekly();
    } else {
      await loadAssignments();
    }
    setReceiptLoadingKey(null);
  }

  if (!report) {
    return <Card title="家长周报">加载中...</Card>;
  }

  if (report.error) {
    return <Card title="家长周报">请先登录家长账号。</Card>;
  }

  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const dueSoonTasks = pendingTasks.filter((task) => {
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff >= 0 && diff <= 2 * 24 * 60 * 60 * 1000;
  });
  const overdueTasks = pendingTasks.filter((task) => new Date(task.dueDate).getTime() < Date.now());
  const reminderText = [
    `本周订正任务：待完成 ${summary?.pending ?? pendingTasks.length} 题。`,
    overdueTasks.length ? `已逾期 ${overdueTasks.length} 题，请尽快完成。` : "",
    dueSoonTasks.length ? `近 2 天到期 ${dueSoonTasks.length} 题。` : "",
    ...dueSoonTasks.slice(0, 3).map((task) => `- ${task.question?.stem ?? "题目"}（截止 ${new Date(task.dueDate).toLocaleDateString("zh-CN")}）`)
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>家长空间</h2>
          <div className="section-sub">掌握学情、作业进度与订正提醒。</div>
        </div>
        <span className="chip">家校协作</span>
      </div>

      <Card title="家长周报" tag="学情">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>近 7 天学习概览与环比变化。</p>
        </div>
        <div className="grid grid-2">
          <Stat label="完成题量" value={`${report.stats.total} 题`} helper="近 7 天" />
          <Stat label="正确率" value={`${report.stats.accuracy}%`} helper="近 7 天" />
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="section-title">上周完成题量</div>
            <p>{report.previousStats?.total ?? 0} 题</p>
          </div>
          <div className="card">
            <div className="section-title">上周正确率</div>
            <p>{report.previousStats?.accuracy ?? 0}%</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">本周可执行行动卡（预计 {report.estimatedMinutes ?? 0} 分钟）</div>
          <div className="grid" style={{ gap: 8, marginTop: 8 }}>
            {(report.actionItems ?? []).map((item: any) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <p>{item.description}</p>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>建议时长：{item.estimatedMinutes} 分钟</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>家长提示：{item.parentTip}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  执行状态：{item.receipt?.status === "done" ? "已打卡" : "未打卡"}
                  {item.receipt?.completedAt ? ` · ${new Date(item.receipt.completedAt).toLocaleString("zh-CN")}` : ""}
                </div>
                <div className="cta-row" style={{ marginTop: 8 }}>
                  <button
                    className="button ghost"
                    type="button"
                    disabled={receiptLoadingKey === `weekly_report:${item.id}`}
                    onClick={() => markReceipt("weekly_report", item)}
                  >
                    {receiptLoadingKey === `weekly_report:${item.id}` ? "打卡中..." : "执行打卡"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>
          执行闭环：建议 {report.execution?.suggestedCount ?? 0} 项 · 已打卡 {report.execution?.completedCount ?? 0} 项 ·
          完成率 {report.execution?.completionRate ?? 0}% · 效果分 {report.effect?.receiptEffectScore ?? 0}
        </div>
      </Card>
      <Card title="薄弱点与建议" tag="诊断">
        <div className="feature-card">
          <EduIcon name="brain" />
          <p>识别薄弱知识点，给出本周提升建议。</p>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {report.weakPoints?.length ? (
            report.weakPoints.map((item: any) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <p>正确率 {item.ratio}%</p>
                <p>建议：本周补做 5 题，巩固该知识点。</p>
              </div>
            ))
          ) : (
            <p>暂无薄弱点数据。</p>
          )}
        </div>
        {report.suggestions?.length ? (
          <div style={{ marginTop: 12 }}>
            <div className="badge">本周建议</div>
            <div className="grid" style={{ gap: 6, marginTop: 8 }}>
              {report.suggestions.map((item: string, idx: number) => (
                <div key={`${item}-${idx}`}>{item}</div>
              ))}
            </div>
          </div>
        ) : null}
        {report.parentTips?.length ? (
          <div style={{ marginTop: 12 }}>
            <div className="badge">家长提示</div>
            <div className="grid" style={{ gap: 6, marginTop: 8 }}>
              {report.parentTips.map((item: string, idx: number) => (
                <div key={`${item}-${idx}`}>{item}</div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
      <Card title="订正任务提醒" tag="督学">
        <div className="feature-card">
          <EduIcon name="pencil" />
          <p>自动生成订正清单与提醒文案。</p>
        </div>
        <div className="grid grid-2">
          <div className="card">
            <div className="section-title">待订正</div>
            <p>{summary?.pending ?? pendingTasks.length} 题</p>
          </div>
          <div className="card">
            <div className="section-title">逾期</div>
            <p>{summary?.overdue ?? overdueTasks.length} 题</p>
          </div>
          <div className="card">
            <div className="section-title">2 天内到期</div>
            <p>{summary?.dueSoon ?? dueSoonTasks.length} 题</p>
          </div>
          <div className="card">
            <div className="section-title">已完成</div>
            <p>{summary?.completed ?? 0} 题</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">提醒文案</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--ink-1)" }}>{reminderText}</pre>
        </div>
        <div className="cta-row">
          <button
            className="button secondary"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reminderText);
                setReminderCopied(true);
                setTimeout(() => setReminderCopied(false), 2000);
              } catch {
                setReminderCopied(false);
              }
            }}
          >
            {reminderCopied ? "已复制" : "复制提醒文案"}
          </button>
        </div>
      </Card>
      <Card title="作业提醒" tag="作业">
        <div className="feature-card">
          <EduIcon name="board" />
          <p>汇总老师布置作业与到期提醒。</p>
        </div>
        <div className="grid grid-2">
          <div className="card">
            <div className="section-title">待完成</div>
            <p>{assignmentSummary?.pending ?? 0} 份</p>
          </div>
          <div className="card">
            <div className="section-title">逾期</div>
            <p>{assignmentSummary?.overdue ?? 0} 份</p>
          </div>
          <div className="card">
            <div className="section-title">2 天内到期</div>
            <p>{assignmentSummary?.dueSoon ?? 0} 份</p>
          </div>
          <div className="card">
            <div className="section-title">已完成</div>
            <p>{assignmentSummary?.completed ?? 0} 份</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">作业行动卡（预计 {assignmentEstimatedMinutes} 分钟）</div>
          {assignmentActionItems.length ? (
            <div className="grid" style={{ gap: 8, marginTop: 8 }}>
              {assignmentActionItems.map((item) => (
                <div className="card" key={item.id}>
                  <div className="section-title">{item.title}</div>
                  <p>{item.description}</p>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>建议时长：{item.estimatedMinutes} 分钟</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    执行状态：{item.receipt?.status === "done" ? "已打卡" : "未打卡"}
                    {item.receipt?.completedAt
                      ? ` · ${new Date(item.receipt.completedAt).toLocaleString("zh-CN")}`
                      : ""}
                  </div>
                  <div className="cta-row" style={{ marginTop: 8 }}>
                    <button
                      className="button ghost"
                      type="button"
                      disabled={receiptLoadingKey === `assignment_plan:${item.id}`}
                      onClick={() => markReceipt("assignment_plan", item)}
                    >
                      {receiptLoadingKey === `assignment_plan:${item.id}` ? "打卡中..." : "执行打卡"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>暂无行动卡。</p>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>
          执行闭环：建议 {assignmentExecution?.suggestedCount ?? 0} 项 · 已打卡{" "}
          {assignmentExecution?.completedCount ?? 0} 项 · 完成率{" "}
          {assignmentExecution?.completionRate ?? 0}%
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">作业清单</div>
          {assignmentList.length ? (
            <div className="grid" style={{ gap: 8 }}>
              {assignmentList.slice(0, 5).map((item) => (
                <div className="card" key={item.id}>
                  <div className="section-title">{item.title}</div>
                  <p>{item.className}</p>
                  <p>截止 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</p>
                  <p>{item.status === "completed" ? "已完成" : "待完成"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>暂无作业。</p>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="section-title">提醒文案</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--ink-1)" }}>{assignmentReminder}</pre>
        </div>
        {assignmentParentTips.length ? (
          <div style={{ marginTop: 12 }}>
            <div className="section-title">监督提示</div>
            <div className="grid" style={{ gap: 6 }}>
              {assignmentParentTips.map((item, idx) => (
                <div key={`${item}-${idx}`} style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="cta-row">
          <button
            className="button secondary"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(assignmentReminder);
                setAssignmentCopied(true);
                setTimeout(() => setAssignmentCopied(false), 2000);
              } catch {
                setAssignmentCopied(false);
              }
            }}
          >
            {assignmentCopied ? "已复制" : "复制作业提醒"}
          </button>
        </div>
      </Card>
      <Card title="收藏题目" tag="复习">
        <div className="feature-card">
          <EduIcon name="book" />
          <p>孩子收藏的重点题目与标签。</p>
        </div>
        {favorites.length ? (
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {favorites.slice(0, 5).map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.question?.stem ?? "题目"}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {item.question?.knowledgePointTitle ?? "知识点"} · {item.question?.grade ?? "-"} 年级
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                  标签：{item.tags?.length ? item.tags.join("、") : "未设置"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: 8 }}>暂无收藏记录。</p>
        )}
      </Card>
    </div>
  );
}
