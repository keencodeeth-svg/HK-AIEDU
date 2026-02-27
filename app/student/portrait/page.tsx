"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";

type AbilityStat = {
  id: string;
  label: string;
  correct: number;
  total: number;
  score: number;
};

type MasterySummary = {
  averageMasteryScore: number;
  trackedKnowledgePoints: number;
  weakKnowledgePoints: {
    knowledgePointId: string;
    title: string;
    subject: string;
    masteryScore: number;
    masteryLevel: "weak" | "developing" | "strong";
    correct: number;
    total: number;
    lastAttemptAt: string | null;
  }[];
};

function buildPolygonPoints(stats: AbilityStat[], radius: number, center: number) {
  const count = stats.length;
  if (!count) return "";
  return stats
    .map((item, index) => {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const r = (item.score / 100) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildGridPoints(count: number, radius: number, center: number) {
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export default function PortraitPage() {
  const [abilities, setAbilities] = useState<AbilityStat[]>([]);
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/radar")
      .then((res) => res.json())
      .then((data) => {
        setAbilities(data?.data?.abilities ?? []);
        setMastery(data?.data?.mastery ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const normalized = abilities;
  const size = 260;
  const center = size / 2;
  const radius = 90;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const polygonPoints = useMemo(() => buildPolygonPoints(normalized, radius, center), [center, normalized, radius]);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习画像</h2>
          <div className="section-sub">多维能力雷达与学科表现。</div>
        </div>
        <span className="chip">能力画像</span>
      </div>

      <Card title="学习画像 / 能力雷达" tag="雷达">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>展示算数、阅读、逻辑等能力分布。</p>
        </div>
        {loading ? (
          <div className="skeleton-grid" style={{ marginTop: 12 }}>
            <div className="skeleton-card">
              <div className="skeleton-line lg w-40" />
              <div className="skeleton-line w-100" />
              <div className="skeleton-line w-80" />
            </div>
          </div>
        ) : normalized.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 280px) 1fr", gap: 24, alignItems: "center" }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {gridLevels.map((level) => (
                <polygon
                  key={level}
                  points={buildGridPoints(normalized.length, radius * level, center)}
                  fill="none"
                  stroke="rgba(27,108,168,0.18)"
                  strokeWidth="1"
                />
              ))}
              {normalized.map((_, index) => {
                const angle = (Math.PI * 2 * index) / normalized.length - Math.PI / 2;
                const x = center + radius * Math.cos(angle);
                const y = center + radius * Math.sin(angle);
                return (
                  <line
                    key={`axis-${index}`}
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke="rgba(27,108,168,0.16)"
                    strokeWidth="1"
                  />
                );
              })}
              <polygon points={polygonPoints} fill="rgba(244,208,111,0.28)" stroke="#d36b3f" strokeWidth="2" />
            </svg>
            <div className="grid" style={{ gap: 10 }}>
              {normalized.map((item) => (
                <div className="card" key={item.id}>
                  <div className="section-title">{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{item.score} 分</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    正确 {item.correct} / 总计 {item.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-title">暂无学习数据</p>
            <p>先完成练习或诊断测评，系统会自动生成能力雷达。</p>
          </div>
        )}
      </Card>

      <Card title="知识点掌握度" tag="mastery">
        <div className="grid grid-2">
          <div className="card">
            <div className="section-title">平均掌握分</div>
            <div className="kpi-value">{mastery?.averageMasteryScore ?? 0} 分</div>
          </div>
          <div className="card">
            <div className="section-title">已跟踪知识点</div>
            <div className="kpi-value">{mastery?.trackedKnowledgePoints ?? 0}</div>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-grid" style={{ marginTop: 12 }}>
            <div className="skeleton-card">
              <div className="skeleton-line lg w-60" />
              <div className="skeleton-line w-80" />
              <div className="skeleton-line w-40" />
            </div>
          </div>
        ) : mastery?.weakKnowledgePoints?.length ? (
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            {mastery.weakKnowledgePoints.map((item) => (
              <div className="card" key={item.knowledgePointId}>
                <div className="section-title">{item.title}</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>掌握分 {item.masteryScore}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  正确 {item.correct} / 总计 {item.total}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <p className="empty-state-title">暂无知识点掌握数据</p>
            <p>完成几轮针对性练习后，这里会展示薄弱知识点。</p>
          </div>
        )}
      </Card>
    </div>
  );
}
