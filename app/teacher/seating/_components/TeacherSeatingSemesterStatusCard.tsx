import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { formatLoadedTime } from "@/lib/client-request";
import type { SeatPlan } from "../types";

type TeacherSeatingSemesterStatusCardProps = {
  semesterStatus: string;
  semesterStatusTone: string;
  savedPlan: SeatPlan | null;
  classLabel: string;
  semesterReplanReasons: string[];
};

export function TeacherSeatingSemesterStatusCard({
  semesterStatus,
  semesterStatusTone,
  savedPlan,
  classLabel,
  semesterReplanReasons
}: TeacherSeatingSemesterStatusCardProps) {
  return (
    <Card title="学期状态" tag={semesterStatus}>
      <div className="feature-card">
        <EduIcon name="chart" />
        <p>排座默认按学期初始化处理：学期初完成正式方案，只有在插班、关键画像明显变化或老师主动复盘时再重排。</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
        <div className="card">
          <div className="section-title">当前状态</div>
          <p style={{ color: semesterStatusTone }}>{semesterStatus}</p>
        </div>
        <div className="card">
          <div className="section-title">正式方案</div>
          <p>{savedPlan ? formatLoadedTime(savedPlan.updatedAt) : "尚未保存"}</p>
        </div>
        <div className="card">
          <div className="section-title">建议触发时机</div>
          <p>插班 / 关键画像变化 / 老师主动复盘</p>
        </div>
        <div className="card">
          <div className="section-title">当前班级</div>
          <p>{classLabel}</p>
        </div>
      </div>
      {semesterReplanReasons.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {semesterReplanReasons.map((reason) => (
            <span key={reason} className="badge">
              {reason}
            </span>
          ))}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          本学期方案已相对稳定，建议只做个别座位微调，不必频繁整体重排。
        </div>
      )}
    </Card>
  );
}
