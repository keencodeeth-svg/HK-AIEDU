import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { studentProfileTextareaStyle } from "../utils";

type StudentProfileSupportNotesCardProps = {
  strengths: string;
  supportNotes: string;
  error: string | null;
  message: string | null;
  saving: boolean;
  onStrengthsChange: (value: string) => void;
  onSupportNotesChange: (value: string) => void;
};

export default function StudentProfileSupportNotesCard({
  strengths,
  supportNotes,
  error,
  message,
  saving,
  onStrengthsChange,
  onSupportNotesChange
}: StudentProfileSupportNotesCardProps) {
  return (
    <Card title="个性与支持说明" tag="协同">
      <div className="feature-card">
        <EduIcon name="puzzle" />
        <p>让老师更了解你的优势和需要关注的点，方便课堂协作与微调座位安排。</p>
      </div>
      <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
        <label>
          <div className="section-title">个人优势</div>
          <textarea
            value={strengths}
            onChange={(event) => onStrengthsChange(event.target.value)}
            placeholder="例如：数学思维好、表达积极、乐于帮助同学"
            style={studentProfileTextareaStyle}
          />
        </label>
        <label>
          <div className="section-title">老师特别关注</div>
          <textarea
            value={supportNotes}
            onChange={(event) => onSupportNotesChange(event.target.value)}
            placeholder="例如：希望坐前排、需要减少干扰、最近注意力波动"
            style={studentProfileTextareaStyle}
          />
        </label>
      </div>

      {error ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{error}</div> : null}
      {message ? <div style={{ color: "#027a48", fontSize: 13, marginTop: 12 }}>{message}</div> : null}
      <div className="cta-row" style={{ marginTop: 12 }}>
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存资料"}
        </button>
      </div>
    </Card>
  );
}
