"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import StatePanel from "@/components/StatePanel";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";
import { useDiagnosticPage } from "./useDiagnosticPage";

export default function DiagnosticPage() {
  const diagnosticPage = useDiagnosticPage();

  const reasonOptions = [
    "概念不清",
    "审题不仔细",
    "计算粗心",
    "方法不会",
    "记忆不牢"
  ];

  const current = diagnosticPage.questions[diagnosticPage.index];
  const busy = diagnosticPage.loadingQuestions || diagnosticPage.submitting;

  if (diagnosticPage.authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可开始诊断测评并生成学习计划。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>诊断测评</h2>
          <div className="section-sub">快速定位知识点薄弱项，生成学习计划。</div>
        </div>
        <span className="chip">学习体检</span>
      </div>

      {diagnosticPage.pageError ? (
        <StatePanel title="本次操作存在异常" description={diagnosticPage.pageError} tone="error" compact />
      ) : null}

      <Card title="诊断测评" tag="测评">
        <div className="feature-card">
          <EduIcon name="book" />
          <p>选择学科与年级，开始 AI 诊断测评。</p>
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">学科</div>
            <select
              value={diagnosticPage.subject}
              onChange={(event) => diagnosticPage.setSubject(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {SUBJECT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">年级</div>
            <select
              value={diagnosticPage.grade}
              onChange={(event) => diagnosticPage.setGrade(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="button primary"
          style={{ marginTop: 12 }}
          onClick={diagnosticPage.startDiagnostic}
          disabled={busy}
        >
          {diagnosticPage.loadingQuestions ? "生成题目中..." : "开始诊断"}
        </button>
      </Card>

      {current ? (
        <Card title={`第 ${diagnosticPage.index + 1} 题`} tag="答题">
          <div className="pill-list" style={{ marginBottom: 10 }}>
            <span className="pill">
              进度 {diagnosticPage.index + 1}/{diagnosticPage.questions.length}
            </span>
            <span className="pill">学科 {SUBJECT_LABELS[diagnosticPage.subject] ?? diagnosticPage.subject}</span>
            <span className="pill">年级 {diagnosticPage.grade}</span>
          </div>
          <MathText as="p" text={current.stem} />
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {current.options.map((option) => (
              <label className="card" key={option} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name={current.id}
                  value={option}
                  checked={diagnosticPage.answers[current.id] === option}
                  onChange={() =>
                    diagnosticPage.setAnswers((prev) => ({ ...prev, [current.id]: option }))
                  }
                  style={{ marginRight: 8 }}
                />
                <MathText text={option} />
              </label>
            ))}
          </div>
          <label style={{ display: "block", marginTop: 12 }}>
            <div className="section-title">错因（可选）</div>
            <select
              value={diagnosticPage.reasons[current.id] ?? ""}
              onChange={(event) =>
                diagnosticPage.setReasons((prev) => ({ ...prev, [current.id]: event.target.value }))
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="">未选择</option>
              {reasonOptions.map((reason) => (
                <option value={reason} key={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <div className="cta-row">
            <button
              className="button secondary"
              disabled={diagnosticPage.index === 0 || busy}
              onClick={() => diagnosticPage.setIndex((prev) => Math.max(prev - 1, 0))}
            >
              上一题
            </button>
            {diagnosticPage.index < diagnosticPage.questions.length - 1 ? (
              <button
                className="button primary"
                onClick={() => diagnosticPage.setIndex((prev) => prev + 1)}
                disabled={busy}
              >
                下一题
              </button>
            ) : (
              <button className="button primary" onClick={diagnosticPage.submitDiagnostic} disabled={busy}>
                {diagnosticPage.submitting ? "提交中..." : "提交诊断"}
              </button>
            )}
          </div>
        </Card>
      ) : null}

      {diagnosticPage.result ? (
        <Card title="诊断结果" tag="报告">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>生成掌握度分布与错因总结。</p>
          </div>
          <div ref={diagnosticPage.reportRef}>
            <p>
              正确 {diagnosticPage.result.correct} / {diagnosticPage.result.total}，正确率 {diagnosticPage.result.accuracy}%。
            </p>
            {diagnosticPage.result.breakdown?.length ? (
              <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                <div className="badge">知识点掌握</div>
                {diagnosticPage.result.breakdown.map((item) => (
                  <div className="card" key={item.knowledgePointId}>
                    <div className="section-title">{item.title}</div>
                    <p>
                      正确 {item.correct}/{item.total}，正确率 {item.accuracy}%
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {diagnosticPage.result.wrongReasons?.length ? (
              <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                <div className="badge">错因分布</div>
                {diagnosticPage.result.wrongReasons.map((item) => (
                  <div key={item.reason}>
                    {item.reason}：{item.count} 次
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="cta-row">
            <button className="button secondary" onClick={() => window.print()} disabled={busy}>
              导出 PDF
            </button>
            <button className="button secondary" onClick={diagnosticPage.exportImage} disabled={busy}>
              导出图片
            </button>
            <Link className="button secondary" href="/plan">
              查看学习计划
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
