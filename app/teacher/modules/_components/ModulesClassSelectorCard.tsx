import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem } from "../types";

type ModulesClassSelectorCardProps = {
  classes: ClassItem[];
  classId: string;
  onClassChange: (value: string) => void;
};

export default function ModulesClassSelectorCard({ classes, classId, onClassChange }: ModulesClassSelectorCardProps) {
  return (
    <Card title="选择班级" tag="班级">
      <label>
        <div className="section-title">班级</div>
        <select
          value={classId}
          onChange={(event) => onClassChange(event.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
        >
          <option value="">{classes.length ? "请选择班级" : "暂无可用班级"}</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}
