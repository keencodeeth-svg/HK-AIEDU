"use client";

import { formatLoadedTime } from "@/lib/client-request";

type TeacherSeatingHeaderProps = {
  classLabel: string;
  lastLoadedAt: string | null;
};

export function TeacherSeatingHeader({ classLabel, lastLoadedAt }: TeacherSeatingHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>学期排座配置</h2>
        <div className="section-sub">学期初先生成一版预览，再由老师确认与微调，兼顾成绩互补、性别、身高和课堂偏好。</div>
      </div>
      <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
        <span className="chip">{classLabel}</span>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <span className="chip">学期初始化</span>
      </div>
    </div>
  );
}
