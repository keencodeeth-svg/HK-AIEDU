"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import Card from "@/components/Card";
import MathText from "@/components/MathText";
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
  createError: string | null;
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
  createError,
  onCreate
}: Props) {
  const previewOptions = form.options
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const hasPreviewContent = Boolean(
    form.stem.trim() || previewOptions.length || form.answer.trim() || form.explanation.trim()
  );
  const controlClassName = "questions-tools-control";

  return (
    <div className="grid grid-2 questions-tools-grid">
      <Card title="批量导入题库（CSV）" tag="导入">
        <details className="questions-tools-fold">
          <summary>展开导入操作</summary>
          <div className="questions-tools-fold-body">
            <p className="questions-tools-note">支持 CSV 导入。若是 Excel，请先另存为 CSV。</p>
            <div className="cta-row questions-tools-row">
              <button className="button secondary" type="button" onClick={onDownloadTemplate}>
                下载模板
              </button>
              <label className="button primary questions-import-upload">
                选择 CSV 文件
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => onImport(event.target.files?.[0])}
                />
              </label>
            </div>
            {importMessage ? <div className="status-note success questions-tools-message">{importMessage}</div> : null}
            {importErrors.length ? (
              <div className="status-note error questions-tools-errors">
                {importErrors.slice(0, 5).map((err) => (
                  <div key={err}>{err}</div>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      </Card>

      <Card title="AI 生成题目" tag="AI">
        <details className="questions-tools-fold">
          <summary>展开 AI 生成配置</summary>
          <div className="questions-tools-fold-body">
            <p className="questions-tools-note">需要配置 LLM（如智谱），系统会按知识点自动生成选择题。</p>
            <form onSubmit={onGenerate} className="compact-form questions-tools-form">
              <label>
                <div className="section-title">生成模式</div>
                <select
                  className={controlClassName}
                  value={aiForm.mode}
                  onChange={(event) => setAiForm((prev) => ({ ...prev, mode: event.target.value }))}
                >
                  <option value="single">单知识点生成</option>
                  <option value="batch">批量生成（按知识点分配）</option>
                </select>
              </label>
              <label>
                <div className="section-title">学科</div>
                <select
                  className={controlClassName}
                  value={aiForm.subject}
                  onChange={(event) => setAiForm((prev) => ({ ...prev, subject: event.target.value }))}
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
                  className={controlClassName}
                  value={aiForm.grade}
                  onChange={(event) => setAiForm((prev) => ({ ...prev, grade: event.target.value }))}
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
                    className={controlClassName}
                    value={aiForm.knowledgePointId}
                    onChange={(event) => setAiForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}
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
                    className={controlClassName}
                    value={aiForm.chapter}
                    onChange={(event) => setAiForm((prev) => ({ ...prev, chapter: event.target.value }))}
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
                  className={controlClassName}
                  value={aiForm.difficulty}
                  onChange={(event) => setAiForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                >
                  <option value="easy">简单</option>
                  <option value="medium">适中</option>
                  <option value="hard">困难</option>
                </select>
              </label>
              <label>
                <div className="section-title">生成题量（{aiForm.mode === "single" ? "1-5" : "10-50"}）</div>
                <input
                  className={controlClassName}
                  type="number"
                  min={aiForm.mode === "single" ? 1 : 10}
                  max={aiForm.mode === "single" ? 5 : 50}
                  value={aiForm.count}
                  onChange={(event) => setAiForm((prev) => ({ ...prev, count: Number(event.target.value) }))}
                />
              </label>
              <button className="button primary" type="submit" disabled={aiLoading}>
                {aiLoading ? "生成中..." : "开始生成"}
              </button>
            </form>
            {aiMessage ? <div className="status-note success questions-tools-message">{aiMessage}</div> : null}
            {aiErrors.length ? (
              <div className="status-note error questions-tools-errors">
                {aiErrors.slice(0, 5).map((err) => (
                  <div key={err}>{err}</div>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      </Card>

      <Card title="新增题目" tag="新增">
        <details className="questions-tools-fold">
          <summary>展开新增题目表单</summary>
          <div className="questions-tools-fold-body">
            <form onSubmit={onCreate} className="compact-form questions-tools-form">
              <label>
                <div className="section-title">学科</div>
                <select
                  className={controlClassName}
                  value={form.subject}
                  onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
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
                  className={controlClassName}
                  value={form.grade}
                  onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
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
                  className={controlClassName}
                  value={form.knowledgePointId}
                  onChange={(event) => setForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}
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
                  className={controlClassName}
                  value={form.difficulty}
                  onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                >
                  <option value="easy">简单</option>
                  <option value="medium">适中</option>
                  <option value="hard">困难</option>
                </select>
              </label>
              <label>
                <div className="section-title">题型</div>
                <select
                  className={controlClassName}
                  value={form.questionType}
                  onChange={(event) => setForm((prev) => ({ ...prev, questionType: event.target.value }))}
                >
                  <option value="choice">选择题</option>
                  <option value="fill">填空题</option>
                  <option value="short">简答题</option>
                </select>
              </label>
              <label>
                <div className="section-title">题干</div>
                <textarea
                  className={controlClassName}
                  value={form.stem}
                  onChange={(event) => setForm((prev) => ({ ...prev, stem: event.target.value }))}
                  rows={3}
                />
              </label>
              <label>
                <div className="section-title">选项（每行一个）</div>
                <textarea
                  className={controlClassName}
                  value={form.options}
                  onChange={(event) => setForm((prev) => ({ ...prev, options: event.target.value }))}
                  rows={4}
                />
              </label>
              <label>
                <div className="section-title">答案</div>
                <input
                  className={controlClassName}
                  value={form.answer}
                  onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
                />
              </label>
              <label>
                <div className="section-title">解析</div>
                <textarea
                  className={controlClassName}
                  value={form.explanation}
                  onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))}
                  rows={3}
                />
              </label>
              {hasPreviewContent ? (
                <div className="card questions-preview-card">
                  <div className="section-title">公式预览</div>
                  <div>
                    <div className="questions-preview-title">题干</div>
                    <MathText as="div" text={form.stem || "（未填写）"} />
                  </div>
                  {previewOptions.length ? (
                    <div>
                      <div className="questions-preview-title">选项</div>
                      <ul className="questions-preview-list">
                        {previewOptions.map((option) => (
                          <li key={option}>
                            <MathText text={option} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <div className="questions-preview-title">答案</div>
                    <MathText text={form.answer || "（未填写）"} />
                  </div>
                  <div>
                    <div className="questions-preview-title">解析</div>
                    <MathText as="div" text={form.explanation || "（未填写）"} />
                  </div>
                </div>
              ) : null}
              <label>
                <div className="section-title">标签（逗号或 | 分隔）</div>
                <input
                  className={controlClassName}
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="如：分数, 图形"
                />
              </label>
              <label>
                <div className="section-title">能力维度（逗号或 | 分隔）</div>
                <input
                  className={controlClassName}
                  value={form.abilities}
                  onChange={(event) => setForm((prev) => ({ ...prev, abilities: event.target.value }))}
                  placeholder="如：计算, 理解"
                />
              </label>
              <button className="button primary" type="submit">
                保存
              </button>
              {createError ? <div className="status-note error questions-tools-message">{createError}</div> : null}
            </form>
          </div>
        </details>
      </Card>
    </div>
  );
}
