import type { Dispatch, SetStateAction } from "react";
import Card from "@/components/Card";
import type { FormState, KnowledgePoint } from "../types";
import { DIFFICULTY_OPTIONS, QUESTION_TYPE_OPTIONS } from "../utils";

type ExamCreatePoolCardProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  filteredPoints: KnowledgePoint[];
};

export default function ExamCreatePoolCard({ form, setForm, filteredPoints }: ExamCreatePoolCardProps) {
  return (
    <Card title="2. 题库策略" tag="Pool">
      <div className="teacher-exam-create-section-grid" id="exam-create-pool">
        <label>
          <div className="section-title">题目数量</div>
          <input
            type="number"
            min={1}
            max={100}
            value={form.questionCount}
            onChange={(event) => setForm((prev) => ({ ...prev, questionCount: Math.max(1, Number(event.target.value || 1)) }))}
            required
          />
        </label>

        <label>
          <div className="section-title">难度</div>
          <select
            value={form.difficulty}
            onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value as FormState["difficulty"] }))}
          >
            {DIFFICULTY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="section-title">题型</div>
          <select value={form.questionType} onChange={(event) => setForm((prev) => ({ ...prev, questionType: event.target.value }))}>
            {QUESTION_TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="teacher-exam-create-span-full">
          <div className="section-title">知识点（可选）</div>
          <select value={form.knowledgePointId} onChange={(event) => setForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}>
            <option value="">全部知识点</option>
            {filteredPoints.map((item) => (
              <option key={item.id} value={item.id}>
                {item.chapter} · {item.title}
              </option>
            ))}
          </select>
        </label>

        <label className="teacher-exam-create-span-full teacher-exam-create-checkbox">
          <input
            type="checkbox"
            checked={form.includeIsolated}
            onChange={(event) => setForm((prev) => ({ ...prev, includeIsolated: event.target.checked }))}
          />
          <span>允许使用隔离池高风险题。默认关闭，适合题库较窄但愿意人工抽检题目的场景。</span>
        </label>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        如果当前配置题库不足，系统会依次放宽题型、难度和知识点。这个页面现在会提前把这种风险显式告诉你，而不是等提交失败。
      </div>
    </Card>
  );
}
