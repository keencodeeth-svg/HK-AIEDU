"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import Card from "@/components/Card";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import type { AiQuestionForm, KnowledgePoint, QuestionForm } from "../types";

type Props = {
  importMessage: string | null;
  importErrors: string[];
  onDownloadTemplate: () => void;
  onImport: (file?: File | null) => Promise<void>;
  aiForm: AiQuestionForm;
  setAiForm: Dispatch<SetStateAction<AiQuestionForm>>;
  aiKnowledgePoints: KnowledgePoint[];
  chapterOptions: string[];
  aiLoading: boolean;
  aiMessage: string | null;
  aiErrors: string[];
  onGenerate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  form: QuestionForm;
  setForm: Dispatch<SetStateAction<QuestionForm>>;
  knowledgePoints: KnowledgePoint[];
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function QuestionsToolsPanel({
  importMessage,
  importErrors,
  onDownloadTemplate,
  onImport,
  aiForm,
  setAiForm,
  aiKnowledgePoints,
  chapterOptions,
  aiLoading,
  aiMessage,
  aiErrors,
  onGenerate,
  form,
  setForm,
  knowledgePoints,
  onCreate
}: Props) {
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card title="批量导入题库（CSV）" tag="导入">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          支持 CSV 导入。若是 Excel，请先另存为 CSV。
        </p>
        <div className="cta-row">
          <button className="button secondary" type="button" onClick={onDownloadTemplate}>
            下载模板
          </button>
          <label className="button primary" style={{ cursor: "pointer" }}>
            选择 CSV 文件
            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(event) => onImport(event.target.files?.[0])}
            />
          </label>
        </div>
        {importMessage ? <div style={{ marginTop: 8 }}>{importMessage}</div> : null}
        {importErrors.length ? (
          <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>
            {importErrors.slice(0, 5).map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="AI 生成题目" tag="AI">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          需要配置 LLM（如智谱），系统会按知识点自动生成选择题。
        </p>
        <form onSubmit={onGenerate} className="compact-form" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">生成模式</div>
            <select
              value={aiForm.mode}
              onChange={(event) => setAiForm((prev) => ({ ...prev, mode: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="single">单知识点生成</option>
              <option value="batch">批量生成（按知识点分配）</option>
            </select>
          </label>
          <label>
            <div className="section-title">学科</div>
            <select
              value={aiForm.subject}
              onChange={(event) => setAiForm((prev) => ({ ...prev, subject: event.target.value }))}
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
              value={aiForm.grade}
              onChange={(event) => setAiForm((prev) => ({ ...prev, grade: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {aiForm.mode === "single" ? (
            <label>
              <div className="section-title">知识点</div>
              <select
                value={aiForm.knowledgePointId}
                onChange={(event) => setAiForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {aiKnowledgePoints.map((kp) => (
                  <option value={kp.id} key={kp.id}>
                    {kp.title} ({kp.grade}年级)
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <div className="section-title">章节筛选（可选）</div>
              <select
                value={aiForm.chapter}
                onChange={(event) => setAiForm((prev) => ({ ...prev, chapter: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {chapterOptions.length === 0 ? <option value="">暂无章节</option> : null}
                {chapterOptions.map((chapter) => (
                  <option value={chapter} key={chapter}>
                    {chapter}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <div className="section-title">难度</div>
            <select
              value={aiForm.difficulty}
              onChange={(event) => setAiForm((prev) => ({ ...prev, difficulty: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="easy">简单</option>
              <option value="medium">适中</option>
              <option value="hard">困难</option>
            </select>
          </label>
          <label>
            <div className="section-title">
              生成题量（{aiForm.mode === "single" ? "1-5" : "10-50"}）
            </div>
            <input
              type="number"
              min={aiForm.mode === "single" ? 1 : 10}
              max={aiForm.mode === "single" ? 5 : 50}
              value={aiForm.count}
              onChange={(event) => setAiForm((prev) => ({ ...prev, count: Number(event.target.value) }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={aiLoading}>
            {aiLoading ? "生成中..." : "开始生成"}
          </button>
        </form>
        {aiMessage ? <div style={{ marginTop: 8 }}>{aiMessage}</div> : null}
        {aiErrors.length ? (
          <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>
            {aiErrors.slice(0, 5).map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="新增题目" tag="新增">
        <form onSubmit={onCreate} className="compact-form">
          <label>
            <div className="section-title">学科</div>
            <select
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
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
              value={form.grade}
              onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">知识点</div>
            <select
              value={form.knowledgePointId}
              onChange={(event) => setForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {knowledgePoints.map((kp) => (
                <option value={kp.id} key={kp.id}>
                  {kp.title} ({kp.grade}年级)
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">难度</div>
            <select
              value={form.difficulty}
              onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="easy">简单</option>
              <option value="medium">适中</option>
              <option value="hard">困难</option>
            </select>
          </label>
          <label>
            <div className="section-title">题型</div>
            <select
              value={form.questionType}
              onChange={(event) => setForm((prev) => ({ ...prev, questionType: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="choice">选择题</option>
              <option value="fill">填空题</option>
              <option value="short">简答题</option>
            </select>
          </label>
          <label>
            <div className="section-title">题干</div>
            <textarea
              value={form.stem}
              onChange={(event) => setForm((prev) => ({ ...prev, stem: event.target.value }))}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">选项（每行一个）</div>
            <textarea
              value={form.options}
              onChange={(event) => setForm((prev) => ({ ...prev, options: event.target.value }))}
              rows={4}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">答案</div>
            <input
              value={form.answer}
              onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">解析</div>
            <textarea
              value={form.explanation}
              onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">标签（逗号或 | 分隔）</div>
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="如：分数, 图形"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">能力维度（逗号或 | 分隔）</div>
            <input
              value={form.abilities}
              onChange={(event) => setForm((prev) => ({ ...prev, abilities: event.target.value }))}
              placeholder="如：计算, 理解"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit">
            保存
          </button>
        </form>
      </Card>
    </div>
  );
}
