"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";

type AbilityStat = {
  id: string;
  label: string;
  correct: number;
  total: number;
  score: number;
};

type WeakKnowledgePoint = {
  knowledgePointId: string;
  title: string;
  subject: string;
  masteryScore: number;
  masteryLevel: "weak" | "developing" | "strong";
  confidenceScore: number;
  recencyWeight: number;
  masteryTrend7d: number;
  weaknessRank: number | null;
  correct: number;
  total: number;
  lastAttemptAt: string | null;
};

type SubjectMastery = {
  subject: string;
  averageMasteryScore: number;
  averageConfidenceScore: number;
  averageTrend7d: number;
  trackedKnowledgePoints: number;
};

type MasterySummary = {
  averageMasteryScore: number;
  averageConfidenceScore: number;
  averageTrend7d: number;
  trackedKnowledgePoints: number;
  weakKnowledgePoints: WeakKnowledgePoint[];
  subjects: SubjectMastery[];
  recentStudyVariantActivity?: {
    recentAttemptCount: number;
    recentCorrectCount: number;
    latestAttemptAt: string;
    latestKnowledgePointId: string;
    latestKnowledgePointTitle: string;
    latestSubject: string;
    latestCorrect: boolean;
    masteryScore: number;
    masteryLevel: "weak" | "developing" | "strong";
    weaknessRank: number | null;
  } | null;
};

type RadarResponse = {
  data?: {
    abilities?: AbilityStat[];
    mastery?: MasterySummary | null;
  };
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

function getMasteryTone(level: WeakKnowledgePoint["masteryLevel"]) {
  if (level === "strong") return "done";
  if (level === "developing") return "pending";
  return "overdue";
}

function getMasteryLabel(level: WeakKnowledgePoint["masteryLevel"]) {
  if (level === "strong") return "已稳固";
  if (level === "developing") return "待巩固";
  return "薄弱";
}

function getRecentStudyVariantSummary(activity: MasterySummary["recentStudyVariantActivity"]) {
  if (!activity) return null;
  return activity.latestCorrect
    ? `最近一轮 Tutor 变式巩固命中了「${activity.latestKnowledgePointTitle}」，当前掌握 ${activity.masteryScore} 分。`
    : `最近一轮 Tutor 变式巩固暴露出「${activity.latestKnowledgePointTitle}」还不稳，当前掌握 ${activity.masteryScore} 分。`;
}

function buildPracticeHref(input?: { subject?: string; knowledgePointId?: string }) {
  const searchParams = new URLSearchParams();
  if (input?.subject?.trim()) {
    searchParams.set("subject", input.subject.trim());
  }
  if (input?.knowledgePointId?.trim()) {
    searchParams.set("knowledgePointId", input.knowledgePointId.trim());
  }
  const query = searchParams.toString();
  return query ? `/practice?${query}` : "/practice";
}

export default function PortraitPage() {
  const [abilities, setAbilities] = useState<AbilityStat[]>([]);
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadPortrait = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setPageError(null);

    try {
      const payload = await requestJson<RadarResponse>("/api/student/radar");
      setAbilities(payload.data?.abilities ?? []);
      setMastery(payload.data?.mastery ?? null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setAbilities([]);
        setMastery(null);
      } else {
        setPageError(getRequestErrorMessage(error, "加载学习画像失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPortrait("initial");
  }, [loadPortrait]);

  const normalized = abilities;
  const size = 260;
  const center = size / 2;
  const radius = 90;
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const polygonPoints = useMemo(() => buildPolygonPoints(normalized, radius, center), [center, normalized, radius]);
  const lowestAbility = useMemo(() => {
    if (!normalized.length) return null;
    return [...normalized].sort((left, right) => left.score - right.score)[0] ?? null;
  }, [normalized]);

  const stageCopy = (() => {
    if (loading) {
      return {
        title: "正在生成你的学习画像",
        description: "系统正在汇总能力表现、掌握度和近期趋势，请稍等。"
      };
    }

    if (!normalized.length && !mastery?.trackedKnowledgePoints) {
      return {
        title: "当前还没有足够的学习画像数据",
        description: "先完成练习、诊断或错题复习，系统会逐步生成更完整的能力和掌握度画像。"
      };
    }

    if (mastery?.weakKnowledgePoints?.length) {
      return {
        title: `当前有 ${mastery.weakKnowledgePoints.length} 个优先补强知识点`,
        description: "建议结合下方薄弱知识点与学科掌握概览，安排下一轮练习和错题复盘。"
      };
    }

    return {
      title: "你的画像已经形成基础轮廓",
      description: lowestAbility
        ? `当前最需要关注的能力是「${lowestAbility.label}」，可以结合练习和错题复习继续提升。`
        : "继续保持练习，系统会随着新数据更新你的能力雷达和掌握趋势。"
    };
  })();
  const weakFocus = mastery?.weakKnowledgePoints?.[0] ?? null;
  const portraitActionPlan = (() => {
    if (mastery?.recentStudyVariantActivity) {
      const activity = mastery.recentStudyVariantActivity;
      return {
        kicker: "基于最新 Tutor 结果",
        title: `先把「${activity.latestKnowledgePointTitle}」迁到正式练习`,
        description: activity.latestCorrect
          ? "这类题你刚在 Tutor 做对过，最适合立刻切到正式练习，把“会做”巩固成“稳定会做”。"
          : "这个知识点刚在 Tutor 暴露出薄弱处，趁记忆还热的时候立刻做正式练习，修复效率最高。",
        primaryLabel: "去做正式练习",
        primaryHref: buildPracticeHref({
          subject: activity.latestSubject,
          knowledgePointId: activity.latestKnowledgePointId
        }),
        secondaryLabel: "回到 Tutor",
        secondaryHref: buildTutorLaunchHref({
          intent: "image",
          source: "student-portrait-recent-tutor",
          subject: activity.latestSubject
        }),
        meta: `最近 24 小时 Tutor 巩固 ${activity.recentAttemptCount} 题 · 当前掌握 ${activity.masteryScore} 分`
      };
    }

    if (weakFocus) {
      return {
        kicker: "基于薄弱知识点",
        title: `先补「${weakFocus.title}」`,
        description: `这是当前最值得优先收口的知识点${typeof weakFocus.weaknessRank === "number" ? `，当前优先级 #${weakFocus.weaknessRank}` : ""}。先做定向练习，再回来观察画像变化。`,
        primaryLabel: "去定向练习",
        primaryHref: buildPracticeHref({
          subject: weakFocus.subject,
          knowledgePointId: weakFocus.knowledgePointId
        }),
        secondaryLabel: "去 Tutor 追问",
        secondaryHref: buildTutorLaunchHref({
          intent: "image",
          source: "student-portrait-weak-focus",
          subject: weakFocus.subject
        }),
        meta: `掌握 ${weakFocus.masteryScore} 分 · 正确 ${weakFocus.correct} / ${weakFocus.total}`
      };
    }

    return {
      kicker: "基于当前画像",
      title: "先做一轮练习，再回来观察画像有没有变化",
      description: "当没有明显单点风险时，最好的动作就是保持练习节奏，然后回到画像页看掌握分、能力雷达和趋势是否继续抬升。",
      primaryLabel: "去做练习",
      primaryHref: "/practice",
      secondaryLabel: "去 Tutor",
      secondaryHref: buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-general"
      }),
      meta: `平均掌握 ${mastery?.averageMasteryScore ?? 0} 分 · 7 日趋势 ${mastery?.averageTrend7d ?? 0}`
    };
  })();

  if (loading && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载学习画像"
        description="正在汇总能力雷达与知识点掌握度，请稍等。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看学习画像"
        description="登录学生账号后，系统才能展示你的个人能力雷达和掌握度画像。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (pageError && !normalized.length && !mastery) {
    return (
      <StatePanel
        tone="error"
        title="学习画像加载失败"
        description={pageError}
        action={
          <button className="button secondary" type="button" onClick={() => void loadPortrait("refresh")}>
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
          <h2>学习画像</h2>
          <div className="section-sub">多维能力雷达、学科掌握概览与薄弱知识点优先级。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">能力 {normalized.length}</span>
          <span className="chip">知识点 {mastery?.trackedKnowledgePoints ?? 0}</span>
          <span className="chip">薄弱点 {mastery?.weakKnowledgePoints.length ?? 0}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadPortrait("refresh")} disabled={refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${pageError}`}
          action={
            <button className="button secondary" type="button" onClick={() => void loadPortrait("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="portrait-stage-banner">
        <div className="portrait-stage-kicker">当前阶段</div>
        <div className="portrait-stage-title">{stageCopy.title}</div>
        <p className="portrait-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">平均掌握 {mastery?.averageMasteryScore ?? 0} 分</span>
          <span className="pill">平均信心 {mastery?.averageConfidenceScore ?? 0} 分</span>
          <span className="pill">7日趋势 {mastery?.averageTrend7d ?? 0}</span>
          {lowestAbility ? <span className="pill">待提升能力：{lowestAbility.label}</span> : null}
        </div>
      </div>

      <Card title="先做这一件事" tag="Action">
        <div className="portrait-action-layout">
          <div className="feature-card portrait-action-hero">
            <EduIcon name="rocket" />
            <div>
              <div className="portrait-action-kicker">{portraitActionPlan.kicker}</div>
              <div className="portrait-action-title">{portraitActionPlan.title}</div>
              <p className="portrait-action-description">{portraitActionPlan.description}</p>
              <div className="meta-text" style={{ marginTop: 8 }}>{portraitActionPlan.meta}</div>
            </div>
          </div>

          <div className="portrait-action-rail">
            <div className="portrait-action-summary">
              <div className="section-title">推荐顺序</div>
              <div className="meta-text">先执行推荐动作，再回看画像页确认掌握分、薄弱优先级和 Tutor 巩固记录有没有变化。</div>
            </div>
            <div className="cta-row portrait-next-actions">
              <Link className="button primary" href={portraitActionPlan.primaryHref}>
                {portraitActionPlan.primaryLabel}
              </Link>
              <Link className="button secondary" href={portraitActionPlan.secondaryHref}>
                {portraitActionPlan.secondaryLabel}
              </Link>
              <Link className="button ghost" href="/student">
                回到学习控制台
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {mastery?.recentStudyVariantActivity ? (
        <Card title="最近 Tutor 巩固" tag="即时变化">
          <div className="feature-card">
            <EduIcon name="brain" />
            <div>
              <div className="section-title">{mastery.recentStudyVariantActivity.latestKnowledgePointTitle}</div>
              <p>{getRecentStudyVariantSummary(mastery.recentStudyVariantActivity)}</p>
            </div>
          </div>
          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">24小时巩固 {mastery.recentStudyVariantActivity.recentAttemptCount} 题</span>
            <span className="pill">答对 {mastery.recentStudyVariantActivity.recentCorrectCount} 题</span>
            <span className="pill">掌握 {mastery.recentStudyVariantActivity.masteryScore}</span>
            {typeof mastery.recentStudyVariantActivity.weaknessRank === "number" ? (
              <span className="pill">薄弱位次 #{mastery.recentStudyVariantActivity.weaknessRank}</span>
            ) : null}
            <span className="pill">更新于 {formatLoadedTime(mastery.recentStudyVariantActivity.latestAttemptAt)}</span>
          </div>
          <div className="cta-row portrait-next-actions" style={{ marginTop: 12 }}>
            <Link
              className="button secondary"
              href={buildPracticeHref({
                subject: mastery.recentStudyVariantActivity.latestSubject,
                knowledgePointId: mastery.recentStudyVariantActivity.latestKnowledgePointId
              })}
            >
              延续巩固
            </Link>
            <Link
              className="button ghost"
              href={buildTutorLaunchHref({
                intent: "image",
                source: "student-portrait-recent-card",
                subject: mastery.recentStudyVariantActivity.latestSubject
              })}
            >
              回到 Tutor
            </Link>
          </div>
        </Card>
      ) : null}

      <Card title="画像概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">能力维度</div>
            <div className="workflow-summary-value">{normalized.length}</div>
            <div className="workflow-summary-helper">已纳入能力雷达统计的维度数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">平均掌握分</div>
            <div className="workflow-summary-value">{mastery?.averageMasteryScore ?? 0}</div>
            <div className="workflow-summary-helper">知识点整体掌握水平的平均分</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">平均信心分</div>
            <div className="workflow-summary-value">{mastery?.averageConfidenceScore ?? 0}</div>
            <div className="workflow-summary-helper">近期作答数据支撑当前画像结论的可信程度</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">7日趋势</div>
            <div className="workflow-summary-value">{mastery?.averageTrend7d ?? 0}</div>
            <div className="workflow-summary-helper">最近 7 天掌握度变化的平均趋势</div>
          </div>
        </div>

        <div className="cta-row portrait-next-actions" style={{ marginTop: 12 }}>
          <Link
            className="button secondary"
            href={buildPracticeHref({
              subject: weakFocus?.subject,
              knowledgePointId: weakFocus?.knowledgePointId
            })}
          >
            去做练习
          </Link>
          <Link
            className="button ghost"
            href={weakFocus ? buildTutorLaunchHref({ intent: "image", source: "student-portrait-overview", subject: weakFocus.subject }) : "/wrong-book"}
          >
            {weakFocus ? "去 Tutor 追问" : "去错题本"}
          </Link>
        </div>
      </Card>

      <Card title="学习画像 / 能力雷达" tag="雷达">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>能力雷达适合快速判断当前强弱项，再结合下方知识点和学科掌握概览安排下一步学习动作。</p>
        </div>

        {!normalized.length ? (
          <div style={{ marginTop: 12 }}>
            <StatePanel
              compact
              tone="empty"
              title="暂无能力雷达数据"
              description="先完成几次练习或诊断测评，系统会自动生成能力维度表现。"
              action={
                <Link className="button secondary" href="/practice">
                  去练习
                </Link>
              }
            />
          </div>
        ) : (
          <div className="portrait-radar-layout">
            <div className="portrait-radar-visual">
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
                  return <line key={`axis-${index}`} x1={center} y1={center} x2={x} y2={y} stroke="rgba(27,108,168,0.16)" strokeWidth="1" />;
                })}
                <polygon points={polygonPoints} fill="rgba(244,208,111,0.28)" stroke="#d36b3f" strokeWidth="2" />
              </svg>
              <div className="portrait-radar-legend">越接近外圈代表当前该能力越稳定；建议优先关注分值最低的 1-2 个维度。</div>
            </div>

            <div className="portrait-ability-grid">
              {normalized.map((item) => (
                <div className="card portrait-ability-card" key={item.id}>
                  <div className="section-title">{item.label}</div>
                  <div className="kpi-value">{item.score} 分</div>
                  <div className="workflow-card-meta">
                    <span className="pill">正确 {item.correct}</span>
                    <span className="pill">总计 {item.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="学科掌握概览" tag="学科">
        {!mastery?.subjects?.length ? (
          <StatePanel
            compact
            tone="empty"
            title="暂无学科掌握概览"
            description="积累更多练习和作答记录后，这里会按学科展示掌握、信心和趋势。"
          />
        ) : (
          <div className="portrait-subject-grid">
            {mastery.subjects.map((item) => (
              <div className="card" key={item.subject}>
                <div className="section-title">{SUBJECT_LABELS[item.subject] ?? item.subject}</div>
                <div className="workflow-card-meta">
                  <span className="pill">掌握 {item.averageMasteryScore}</span>
                  <span className="pill">信心 {item.averageConfidenceScore}</span>
                  <span className="pill">趋势 {item.averageTrend7d}</span>
                </div>
                <div className="student-module-resource-meta">已跟踪 {item.trackedKnowledgePoints} 个知识点，可据此安排对应学科的复习优先级。</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="薄弱知识点" tag="mastery">
        {!mastery?.weakKnowledgePoints?.length ? (
          <StatePanel
            compact
            tone="empty"
            title="当前没有明显薄弱知识点"
            description="继续保持练习和复盘，系统会在发现风险点时自动更新这里的优先清单。"
          />
        ) : (
          <div className="portrait-weak-grid">
            {mastery.weakKnowledgePoints.map((item) => (
              <div className="card" key={item.knowledgePointId}>
                <div className="section-title">{item.title}</div>
                <div className="workflow-card-meta">
                  <span className={`gradebook-pill ${getMasteryTone(item.masteryLevel)}`}>{getMasteryLabel(item.masteryLevel)}</span>
                  <span className="pill">{SUBJECT_LABELS[item.subject] ?? item.subject}</span>
                  {item.weaknessRank ? <span className="pill">优先级 #{item.weaknessRank}</span> : null}
                </div>
                <div className="student-module-resource-meta">
                  掌握分 {item.masteryScore} · 信心分 {item.confidenceScore} · 7日趋势 {item.masteryTrend7d}
                </div>
                <div className="student-module-resource-meta">
                  正确 {item.correct} / 总计 {item.total}
                  {item.lastAttemptAt ? ` · 最近作答 ${formatLoadedTime(item.lastAttemptAt)}` : " · 暂无最近作答时间"}
                </div>
                <div className="cta-row portrait-next-actions">
                  <Link
                    className="button secondary"
                    href={buildPracticeHref({
                      subject: item.subject,
                      knowledgePointId: item.knowledgePointId
                    })}
                  >
                    去练习
                  </Link>
                  <Link className="button ghost" href="/wrong-book">
                    去错题本
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
