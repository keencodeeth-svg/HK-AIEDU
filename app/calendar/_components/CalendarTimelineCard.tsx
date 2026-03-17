"use client";

import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { CalendarItem } from "../types";
import { getTimelineStatusLabel, TYPE_LABELS } from "../utils";

type Props = {
  items: CalendarItem[];
};

export default function CalendarTimelineCard({ items }: Props) {
  return (
    <Card title="学习时间线" tag={`${items.length} 项`}>
      {!items.length ? (
        <StatePanel
          compact
          tone="empty"
          title="当前没有时间线事件"
          description="后续课程、作业、公告和订正提醒会集中出现在这里。"
        />
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {items.map((item) => (
            <div className="card" key={`${item.type}-${item.id}-${item.date}`}>
              <div
                className="cta-row"
                style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
              >
                <div>
                  <div className="section-title">{item.title}</div>
                  <div className="section-sub" style={{ marginTop: 4 }}>
                    {new Date(item.date).toLocaleString("zh-CN")}{" "}
                    {item.className ? `· ${item.className}` : ""}
                  </div>
                </div>
                <div className="badge-row" style={{ marginTop: 0 }}>
                  <span className="pill">{TYPE_LABELS[item.type]}</span>
                  {item.status ? <span className="pill">{getTimelineStatusLabel(item)}</span> : null}
                </div>
              </div>
              {item.description ? (
                <div className="meta-text" style={{ marginTop: 8 }}>
                  {item.description}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
