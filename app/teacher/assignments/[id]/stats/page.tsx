"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";

export default function AssignmentStatsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/teacher/assignments/${params.id}/stats`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.error) {
          setError(payload.error);
        } else {
          setData(payload);
        }
      });
  }, [params.id]);

  const maxCount = useMemo(() => {
    if (!data?.distribution?.length) return 1;
    return Math.max(...data.distribution.map((item: any) => item.count), 1);
  }, [data]);

  if (error) {
    return (
      <Card title="作业统计">
        <p>{error}</p>
        <Link className="button secondary" href={`/teacher/assignments/${params.id}`} style={{ marginTop: 12 }}>
          返回作业详情
        </Link>
      </Card>
    );
  }

  if (!data) {
    return <Card title="作业统计">加载中...</Card>;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>作业统计</h2>
          <div className="section-sub">
            {data.class?.name} · {SUBJECT_LABELS[data.class?.subject] ?? data.class?.subject} · {data.class?.grade} 年级
          </div>
        </div>
        <span className="chip">{ASSIGNMENT_TYPE_LABELS[data.assignment?.submissionType ?? "quiz"]}</span>
      </div>

      <Card title="统计概览" tag="概览">
        <div className="grid grid-2">
          <div className="card">
            <div className="section-title">学生数</div>
            <p>{data.summary?.students ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">已完成</div>
            <p>{data.summary?.completed ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">待交</div>
            <p>{data.summary?.pending ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">逾期</div>
            <p>{data.summary?.overdue ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">平均分</div>
            <p>{data.summary?.avgScore ?? 0}</p>
          </div>
          <div className="card">
            <div className="section-title">最高/最低</div>
            <p>
              {data.summary?.maxScore ?? 0} / {data.summary?.minScore ?? 0}
            </p>
          </div>
        </div>
        <Link className="button ghost" href={`/teacher/assignments/${params.id}`} style={{ marginTop: 12 }}>
          返回作业详情
        </Link>
      </Card>

      <Card title="成绩分布" tag="分布">
        {data.distribution?.length ? (
          <div className="grid" style={{ gap: 8 }}>
            {data.distribution.map((item: any) => (
              <div key={item.label} className="card">
                <div className="section-title">{item.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #1f6feb, #7ec4ff)",
                      width: `${(item.count / maxCount) * 100}%`
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{item.count} 人</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无分布数据。</p>
        )}
      </Card>

      {data.questionStats?.length ? (
        <Card title="题目正确率" tag="题目">
          <div className="grid" style={{ gap: 10 }}>
            {data.questionStats.map((item: any) => (
              <div className="card" key={item.id}>
                <div className="section-title">
                  <MathText text={item.stem} />
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  正确 {item.correct}/{item.total} · 正确率 {item.ratio}%
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 8,
                    borderRadius: 999,
                    background: "#f1f5f9",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: `${item.ratio}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #16a34a, #65a30d)"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="题目正确率" tag="题目">
          <p>该作业非在线作答，暂无题目统计。</p>
        </Card>
      )}
    </div>
  );
}
