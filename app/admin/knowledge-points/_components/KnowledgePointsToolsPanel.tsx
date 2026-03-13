"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import Card from "@/components/Card";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePointBatchPreviewItem,
  KnowledgePointForm,
  TreeForm
} from "../types";

type Props = {
  batchForm: BatchForm;
  setBatchForm: Dispatch<SetStateAction<BatchForm>>;
  batchLoading: boolean;
  batchError: string | null;
  batchMessage: string | null;
  batchProgress: string | null;
  batchPreview: KnowledgePointBatchPreviewItem[];
  batchShowDetail: boolean;
  setBatchShowDetail: Dispatch<SetStateAction<boolean>>;
  batchConfirming: boolean;
  onBatchPreview: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBatchConfirm: () => Promise<void>;
  onClearBatchPreview: () => void;
  treeForm: TreeForm;
  setTreeForm: Dispatch<SetStateAction<TreeForm>>;
  treeLoading: boolean;
  treeMessage: string | null;
  treeErrors: string[];
  onTreeGenerate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  aiForm: AiKnowledgePointForm;
  setAiForm: Dispatch<SetStateAction<AiKnowledgePointForm>>;
  chapterOptions: string[];
  aiLoading: boolean;
  aiMessage: string | null;
  aiErrors: string[];
  onAiGenerate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  form: KnowledgePointForm;
  setForm: Dispatch<SetStateAction<KnowledgePointForm>>;
  formError: string | null;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function KnowledgePointsToolsPanel({
  batchForm,
  setBatchForm,
  batchLoading,
  batchError,
  batchMessage,
  batchProgress,
  batchPreview,
  batchShowDetail,
  setBatchShowDetail,
  batchConfirming,
  onBatchPreview,
  onBatchConfirm,
  onClearBatchPreview,
  treeForm,
  setTreeForm,
  treeLoading,
  treeMessage,
  treeErrors,
  onTreeGenerate,
  aiForm,
  setAiForm,
  chapterOptions,
  aiLoading,
  aiMessage,
  aiErrors,
  onAiGenerate,
  form,
  setForm,
  formError,
  onCreate
}: Props) {
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card title="批量生成全学科/全年级（预览后确认）" tag="批量">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          先生成预览，再确认入库。支持控制单元/章节/知识点数量模板。
        </p>
        <form onSubmit={onBatchPreview} className="compact-form" style={{ marginTop: 12 }}>
          <div className="grid grid-3">
            <label>
              <div className="section-title">学科</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUBJECT_OPTIONS.map((subject) => (
                  <label key={subject.value} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={batchForm.subjects.includes(subject.value)}
                      onChange={(event) => {
                        setBatchForm((prev) => ({
                          ...prev,
                          subjects: event.target.checked
                            ? [...prev.subjects, subject.value]
                            : prev.subjects.filter((item) => item !== subject.value)
                        }));
                      }}
                    />
                    {subject.label}
                  </label>
                ))}
              </div>
            </label>
            <label>
              <div className="section-title">年级</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GRADE_OPTIONS.map((grade) => (
                  <label key={grade.value} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={batchForm.grades.includes(grade.value)}
                      onChange={(event) => {
                        setBatchForm((prev) => ({
                          ...prev,
                          grades: event.target.checked
                            ? [...prev.grades, grade.value]
                            : prev.grades.filter((item) => item !== grade.value)
                        }));
                      }}
                    />
                    {grade.label}
                  </label>
                ))}
              </div>
            </label>
            <label>
              <div className="section-title">册次</div>
              <select
                value={batchForm.volume}
                onChange={(event) => setBatchForm((prev) => ({ ...prev, volume: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="上册">上册</option>
                <option value="下册">下册</option>
                <option value="全册">全册</option>
              </select>
            </label>
          </div>
          <div className="grid grid-3">
            <label>
              <div className="section-title">单元数量</div>
              <input
                type="number"
                min={1}
                max={12}
                value={batchForm.unitCount}
                onChange={(event) => setBatchForm((prev) => ({ ...prev, unitCount: Number(event.target.value) }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">每单元章节数</div>
              <input
                type="number"
                min={1}
                max={4}
                value={batchForm.chaptersPerUnit}
                onChange={(event) =>
                  setBatchForm((prev) => ({ ...prev, chaptersPerUnit: Number(event.target.value) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">每章知识点数</div>
              <input
                type="number"
                min={2}
                max={8}
                value={batchForm.pointsPerChapter}
                onChange={(event) =>
                  setBatchForm((prev) => ({ ...prev, pointsPerChapter: Number(event.target.value) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          </div>
          <button className="button primary" type="submit" disabled={batchLoading}>
            {batchLoading ? "生成中..." : "生成预览"}
          </button>
        </form>
        {batchError ? <div style={{ marginTop: 8, color: "#b42318" }}>{batchError}</div> : null}
        {batchProgress ? <div style={{ marginTop: 8, color: "var(--ink-1)" }}>{batchProgress}</div> : null}
        {batchMessage ? <div style={{ marginTop: 8 }}>{batchMessage}</div> : null}
        {batchPreview.length ? (
          <div style={{ marginTop: 16 }}>
            <div className="section-title">预览结果</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={batchShowDetail}
                  onChange={(event) => setBatchShowDetail(event.target.checked)}
                />
                展示章节/知识点详情
              </label>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {batchPreview.map((item) => (
                <div className="card" key={`${item.subject}-${item.grade}`}>
                  <div className="section-title">
                    {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </div>
                  {item.units?.slice(0, 3).map((unit) => (
                    <div key={unit.title} style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 600 }}>{unit.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        章节数：{unit.chapters?.length ?? 0}
                      </div>
                      {batchShowDetail ? (
                        <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                          {unit.chapters?.map((chapter) => (
                            <div className="card" key={`${unit.title}-${chapter.title}`}>
                              <div style={{ fontWeight: 600 }}>{chapter.title}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                {chapter.points?.map((point) => (
                                  <span className="badge" key={`${unit.title}-${chapter.title}-${point.title}`}>
                                    {point.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {item.units?.length > 3 ? (
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>… 共 {item.units.length} 个单元</div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="cta-row">
              <button className="button secondary" type="button" onClick={onClearBatchPreview}>
                清空预览
              </button>
              <button className="button primary" type="button" onClick={onBatchConfirm} disabled={batchConfirming}>
                {batchConfirming ? "入库中..." : "确认入库"}
              </button>
            </div>
          </div>
        ) : null}
      </Card>
      <Card title="AI 生成知识点树（整本书）" tag="树形">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          按“单元 → 章节 → 知识点”生成整本书结构（建议先执行该功能）。
        </p>
        <form onSubmit={onTreeGenerate} className="compact-form" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">学科</div>
            <select
              value={treeForm.subject}
              onChange={(event) => setTreeForm((prev) => ({ ...prev, subject: event.target.value }))}
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
              value={treeForm.grade}
              onChange={(event) => setTreeForm((prev) => ({ ...prev, grade: event.target.value }))}
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
            <div className="section-title">教材版本</div>
            <input
              value={treeForm.edition}
              onChange={(event) => setTreeForm((prev) => ({ ...prev, edition: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">册次</div>
            <select
              value={treeForm.volume}
              onChange={(event) => setTreeForm((prev) => ({ ...prev, volume: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="上册">上册</option>
              <option value="下册">下册</option>
              <option value="全册">全册</option>
            </select>
          </label>
          <label>
            <div className="section-title">单元数量（1-12）</div>
            <input
              type="number"
              min={1}
              max={12}
              value={treeForm.unitCount}
              onChange={(event) => setTreeForm((prev) => ({ ...prev, unitCount: Number(event.target.value) }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={treeLoading}>
            {treeLoading ? "生成中..." : "生成知识点树"}
          </button>
        </form>
        {treeMessage ? <div style={{ marginTop: 8 }}>{treeMessage}</div> : null}
        {treeErrors.length ? (
          <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>
            {treeErrors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="AI 生成知识点" tag="AI">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          需要配置 LLM（如智谱），系统会按学科/年级生成知识点。
        </p>
        <form onSubmit={onAiGenerate} className="compact-form" style={{ marginTop: 12 }}>
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
          <label>
            <div className="section-title">章节（可选）</div>
            <select
              value={aiForm.chapter}
              onChange={(event) => setAiForm((prev) => ({ ...prev, chapter: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="">不指定</option>
              {chapterOptions.map((chapter) => (
                <option value={chapter} key={chapter}>
                  {chapter}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">生成数量（1-10）</div>
            <input
              type="number"
              min={1}
              max={10}
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
      <Card title="新增知识点" tag="新增">
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
            <div className="section-title">单元</div>
            <input
              value={form.unit}
              onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
              placeholder="如：第一单元"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">知识点名称</div>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">章节</div>
            <input
              value={form.chapter}
              onChange={(event) => setForm((prev) => ({ ...prev, chapter: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit">
            保存
          </button>
          {formError ? <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>{formError}</div> : null}
        </form>
      </Card>
    </div>
  );
}
