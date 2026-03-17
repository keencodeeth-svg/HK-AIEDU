"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { StudentGrowthData } from "./types";
import { getStudentGrowthRequestMessage } from "./utils";

type StudentGrowthResponse = StudentGrowthData & {
  error?: string;
};

export default function StudentGrowthPage() {
  const requestIdRef = useRef(0);
  const hasGrowthSnapshotRef = useRef(false);
  const [data, setData] = useState<StudentGrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const clearGrowthState = useCallback(() => {
    hasGrowthSnapshotRef.current = false;
    setData(null);
    setPageError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearGrowthState();
    setAuthRequired(true);
  }, [clearGrowthState]);

  const loadGrowth = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isRefresh = mode === "refresh";

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const payload = await requestJson<StudentGrowthResponse>("/api/student/growth");
      if (requestId !== requestIdRef.current) {
        return;
      }

      setData(payload);
      setAuthRequired(false);
      hasGrowthSnapshotRef.current = true;
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasGrowthSnapshotRef.current) {
          clearGrowthState();
        }
        setAuthRequired(false);
        setPageError(getStudentGrowthRequestMessage(error, "加载成长档案失败"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearGrowthState, handleAuthRequired]);

  useEffect(() => {
    void loadGrowth();
  }, [loadGrowth]);

  if (loading && !data && !authRequired) {
    return <StatePanel title="成长档案加载中" description="正在汇总练习轨迹、学科掌握度与薄弱点。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看学习轨迹、学科掌握度与薄弱点分析。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !data) {
    return (
      <StatePanel
        title="成长档案加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadGrowth()}>
            重试
          </button>
        }
      />
    );
  }

  if (!data) {
    return (
      <StatePanel
        title="成长档案暂时不可用"
        description="当前未能同步成长分析数据，请稍后再试。"
        tone="empty"
        action={
          <button className="button secondary" type="button" onClick={() => void loadGrowth()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>成长档案</h2>
          <div className="section-sub">学习轨迹、学科掌握度与薄弱点。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">成长分析</span>
          <button className="button secondary" type="button" onClick={() => void loadGrowth("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? <StatePanel title="本次刷新存在异常" description={pageError} tone="error" compact /> : null}

      <Card title="学习路径总览" tag="总览">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>练习量、正确率与近 7 天表现。</p>
        </div>
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">总练习题量</div>
            <p>{data.summary.totalAttempts} 题</p>
          </div>
          <div className="card">
            <div className="section-title">总体正确率</div>
            <p>{data.summary.accuracy}%</p>
          </div>
          <div className="card">
            <div className="section-title">近 7 天正确率</div>
            <p>{data.summary.last7Accuracy}%</p>
          </div>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="section-title">近 7 天练习</div>
            <p>{data.summary.last7Total} 题</p>
          </div>
          <div className="card">
            <div className="section-title">已完成作业</div>
            <p>{data.summary.assignmentsCompleted} 份</p>
          </div>
        </div>
      </Card>

      <Card title="学科掌握度" tag="学科">
        {data.subjects.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {data.subjects.map((item) => (
              <div className="card" key={item.subject}>
                <div className="section-title">{SUBJECT_LABELS[item.subject] ?? item.subject}</div>
                <p>正确率 {item.accuracy}%</p>
                <p>练习 {item.total} 题</p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无练习数据。</p>
        )}
      </Card>

      <Card title="薄弱知识点" tag="薄弱">
        {data.weakPoints.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {data.weakPoints.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <p>
                  {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </p>
                <p>正确率 {item.ratio}% · 练习 {item.total} 次</p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无薄弱点记录。</p>
        )}
      </Card>
    </div>
  );
}
