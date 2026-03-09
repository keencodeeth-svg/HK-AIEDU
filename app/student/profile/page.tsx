"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { getRequestErrorMessage, requestJson } from "@/lib/client-request";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import {
  calculateStudentPersonaCompleteness,
  STUDENT_EYESIGHT_LEVEL_LABELS,
  STUDENT_EYESIGHT_LEVEL_VALUES,
  STUDENT_FOCUS_SUPPORT_LABELS,
  STUDENT_FOCUS_SUPPORT_VALUES,
  STUDENT_GENDER_LABELS,
  STUDENT_GENDER_VALUES,
  STUDENT_PERSONALITY_LABELS,
  STUDENT_PERSONALITY_VALUES,
  STUDENT_PERSONA_MUTABLE_FIELDS,
  STUDENT_PEER_SUPPORT_LABELS,
  STUDENT_PEER_SUPPORT_VALUES,
  STUDENT_SEAT_PREFERENCE_LABELS,
  STUDENT_SEAT_PREFERENCE_VALUES
} from "@/lib/student-persona-options";

type StudentProfilePayload = {
  grade?: string;
  subjects?: string[];
  target?: string;
  school?: string;
  preferredName?: string;
  gender?: (typeof STUDENT_GENDER_VALUES)[number];
  heightCm?: number;
  eyesightLevel?: (typeof STUDENT_EYESIGHT_LEVEL_VALUES)[number];
  seatPreference?: (typeof STUDENT_SEAT_PREFERENCE_VALUES)[number];
  personality?: (typeof STUDENT_PERSONALITY_VALUES)[number];
  focusSupport?: (typeof STUDENT_FOCUS_SUPPORT_VALUES)[number];
  peerSupport?: (typeof STUDENT_PEER_SUPPORT_VALUES)[number];
  strengths?: string;
  supportNotes?: string;
  profileCompleteness?: number;
  missingPersonaFields?: string[];
};

type ProfileResponse = { data?: StudentProfilePayload };
type ObserverCodeResponse = { data?: { code?: string | null } };

type ProfileFormState = {
  grade: string;
  subjects: string[];
  target: string;
  school: string;
  preferredName: string;
  gender: "" | (typeof STUDENT_GENDER_VALUES)[number];
  heightCm: string;
  eyesightLevel: "" | (typeof STUDENT_EYESIGHT_LEVEL_VALUES)[number];
  seatPreference: "" | (typeof STUDENT_SEAT_PREFERENCE_VALUES)[number];
  personality: "" | (typeof STUDENT_PERSONALITY_VALUES)[number];
  focusSupport: "" | (typeof STUDENT_FOCUS_SUPPORT_VALUES)[number];
  peerSupport: "" | (typeof STUDENT_PEER_SUPPORT_VALUES)[number];
  strengths: string;
  supportNotes: string;
};

const INITIAL_FORM: ProfileFormState = {
  grade: "4",
  subjects: ["math", "chinese", "english"],
  target: "",
  school: "",
  preferredName: "",
  gender: "",
  heightCm: "",
  eyesightLevel: "",
  seatPreference: "",
  personality: "",
  focusSupport: "",
  peerSupport: "",
  strengths: "",
  supportNotes: ""
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)"
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: 96,
  resize: "vertical" as const
};

export default function StudentProfilePage() {
  const [form, setForm] = useState<ProfileFormState>(INITIAL_FORM);
  const [observerCode, setObserverCode] = useState("");
  const [observerCopied, setObserverCopied] = useState(false);
  const [observerMessage, setObserverMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const personaCompleteness = useMemo(
    () =>
      calculateStudentPersonaCompleteness({
        preferredName: form.preferredName,
        gender: form.gender || undefined,
        heightCm: form.heightCm.trim() ? Number(form.heightCm) : undefined,
        eyesightLevel: form.eyesightLevel || undefined,
        seatPreference: form.seatPreference || undefined,
        personality: form.personality || undefined,
        focusSupport: form.focusSupport || undefined,
        peerSupport: form.peerSupport || undefined,
        strengths: form.strengths,
        supportNotes: form.supportNotes
      }),
    [form]
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [profilePayload, observerPayload] = await Promise.all([
          requestJson<ProfileResponse>("/api/student/profile"),
          requestJson<ObserverCodeResponse>("/api/student/observer-code")
        ]);
        const profile = profilePayload.data;
        if (profile) {
          setForm({
            grade: profile.grade || INITIAL_FORM.grade,
            subjects: profile.subjects?.length ? profile.subjects : INITIAL_FORM.subjects,
            target: profile.target ?? "",
            school: profile.school ?? "",
            preferredName: profile.preferredName ?? "",
            gender: profile.gender ?? "",
            heightCm: typeof profile.heightCm === "number" ? String(profile.heightCm) : "",
            eyesightLevel: profile.eyesightLevel ?? "",
            seatPreference: profile.seatPreference ?? "",
            personality: profile.personality ?? "",
            focusSupport: profile.focusSupport ?? "",
            peerSupport: profile.peerSupport ?? "",
            strengths: profile.strengths ?? "",
            supportNotes: profile.supportNotes ?? ""
          });
        }
        setObserverCode(observerPayload.data?.code ?? "");
      } catch (nextError) {
        setError(getRequestErrorMessage(nextError, "加载学生资料失败"));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  function updateForm<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSubject(key: string) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(key)
        ? prev.subjects.filter((item) => item !== key)
        : [...prev.subjects, key]
    }));
  }

  async function loadObserverCode() {
    try {
      const payload = await requestJson<ObserverCodeResponse>("/api/student/observer-code");
      setObserverCode(payload.data?.code ?? "");
    } catch {
      setObserverCode("");
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: form.grade,
          subjects: form.subjects,
          target: form.target,
          school: form.school,
          preferredName: form.preferredName,
          gender: form.gender || null,
          heightCm: form.heightCm.trim() ? Number(form.heightCm) : null,
          eyesightLevel: form.eyesightLevel || null,
          seatPreference: form.seatPreference || null,
          personality: form.personality || null,
          focusSupport: form.focusSupport || null,
          peerSupport: form.peerSupport || null,
          strengths: form.strengths,
          supportNotes: form.supportNotes
        })
      });
      const payload = (await response.json()) as ProfileResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "保存失败");
      }
      const nextProfile = payload.data;
      if (nextProfile) {
        setForm((prev) => ({
          ...prev,
          preferredName: nextProfile.preferredName ?? prev.preferredName,
          gender: nextProfile.gender ?? "",
          heightCm: typeof nextProfile.heightCm === "number" ? String(nextProfile.heightCm) : "",
          eyesightLevel: nextProfile.eyesightLevel ?? "",
          seatPreference: nextProfile.seatPreference ?? "",
          personality: nextProfile.personality ?? "",
          focusSupport: nextProfile.focusSupport ?? "",
          peerSupport: nextProfile.peerSupport ?? "",
          strengths: nextProfile.strengths ?? "",
          supportNotes: nextProfile.supportNotes ?? ""
        }));
      }
      if (!observerCode) {
        await loadObserverCode();
      }
      setMessage("已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。");
    } catch (nextError) {
      setError(getRequestErrorMessage(nextError, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <StatePanel
        title="学生资料加载中"
        description="正在同步学习档案、课堂偏好和家长绑定信息。"
        tone="loading"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18, maxWidth: 960 }}>
      <div className="section-head">
        <div>
          <h2>学生资料</h2>
          <div className="section-sub">补齐学习画像、课堂偏好与支持信息，让 AI 推荐和学期排座更准确。</div>
        </div>
        <span className="chip">学习档案</span>
      </div>

      <Card title="资料完整度" tag="AI 协同">
        <div className="feature-card">
          <EduIcon name="brain" />
          <p>当前完整度 {personaCompleteness.percentage}% ，资料越完整，老师端学期排座配置和系统推荐越精准。</p>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="section-title">已完成字段</div>
            <p>{personaCompleteness.completedFields} / {STUDENT_PERSONA_MUTABLE_FIELDS.length}</p>
          </div>
          <div className="card">
            <div className="section-title">主要用途</div>
            <p>学期排座配置 · 个性化推荐 · 课堂协同 · 家校支持</p>
          </div>
          <div className="card">
            <div className="section-title">建议动作</div>
            <p>{personaCompleteness.missingFields.length ? "继续补齐课堂相关信息" : "已达到高质量画像"}</p>
          </div>
        </div>
        {personaCompleteness.missingFields.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {personaCompleteness.missingFields.map((field) => (
              <span key={field} className="badge">
                待补：{field}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      <form onSubmit={handleSave} style={{ display: "grid", gap: 18 }}>
        <Card title="基础学习信息" tag="学习">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>年级、学科和目标会影响题目推荐、计划生成和学习路径。</p>
          </div>
          <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
            <label>
              <div className="section-title">年级</div>
              <select value={form.grade} onChange={(event) => updateForm("grade", event.target.value)} style={inputStyle}>
                {GRADE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">学习目标</div>
              <input
                value={form.target}
                onChange={(event) => updateForm("target", event.target.value)}
                placeholder="例如：提升数学应用题和阅读理解"
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <div className="section-title">学校（可选）</div>
              <input value={form.school} onChange={(event) => updateForm("school", event.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="section-title">学习学科</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              {SUBJECT_OPTIONS.map((subject) => (
                <label key={subject.value} className="card" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.subjects.includes(subject.value)}
                    onChange={() => toggleSubject(subject.value)}
                    style={{ marginRight: 8 }}
                  />
                  {subject.label}
                </label>
              ))}
            </div>
          </div>
        </Card>

        <Card title="课堂与学期座位偏好" tag="学期排座">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>这些信息会进入老师端学期排座配置，综合考虑成绩互补、性别、身高、前排需求、专注支持与同桌协作。</p>
          </div>
          <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
            <label>
              <div className="section-title">常用称呼</div>
              <input
                value={form.preferredName}
                onChange={(event) => updateForm("preferredName", event.target.value)}
                placeholder="例如：小宇 / 英文名"
                style={inputStyle}
              />
            </label>
            <label>
              <div className="section-title">身高（cm）</div>
              <input
                value={form.heightCm}
                onChange={(event) => updateForm("heightCm", event.target.value.replace(/[^\d]/g, ""))}
                placeholder="例如：146"
                inputMode="numeric"
                style={inputStyle}
              />
            </label>
            <label>
              <div className="section-title">性别信息</div>
              <select value={form.gender} onChange={(event) => updateForm("gender", event.target.value as ProfileFormState["gender"])} style={inputStyle}>
                <option value="">请选择</option>
                {STUDENT_GENDER_VALUES.map((item) => (
                  <option key={item} value={item}>
                    {STUDENT_GENDER_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">视力 / 前排需求</div>
              <select
                value={form.eyesightLevel}
                onChange={(event) => updateForm("eyesightLevel", event.target.value as ProfileFormState["eyesightLevel"])}
                style={inputStyle}
              >
                <option value="">请选择</option>
                {STUDENT_EYESIGHT_LEVEL_VALUES.map((item) => (
                  <option key={item} value={item}>
                    {STUDENT_EYESIGHT_LEVEL_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">座位偏好</div>
              <select
                value={form.seatPreference}
                onChange={(event) => updateForm("seatPreference", event.target.value as ProfileFormState["seatPreference"])}
                style={inputStyle}
              >
                <option value="">请选择</option>
                {STUDENT_SEAT_PREFERENCE_VALUES.map((item) => (
                  <option key={item} value={item}>
                    {STUDENT_SEAT_PREFERENCE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">课堂性格</div>
              <select
                value={form.personality}
                onChange={(event) => updateForm("personality", event.target.value as ProfileFormState["personality"])}
                style={inputStyle}
              >
                <option value="">请选择</option>
                {STUDENT_PERSONALITY_VALUES.map((item) => (
                  <option key={item} value={item}>
                    {STUDENT_PERSONALITY_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">专注支持</div>
              <select
                value={form.focusSupport}
                onChange={(event) => updateForm("focusSupport", event.target.value as ProfileFormState["focusSupport"])}
                style={inputStyle}
              >
                <option value="">请选择</option>
                {STUDENT_FOCUS_SUPPORT_VALUES.map((item) => (
                  <option key={item} value={item}>
                    {STUDENT_FOCUS_SUPPORT_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">同桌协作</div>
              <select
                value={form.peerSupport}
                onChange={(event) => updateForm("peerSupport", event.target.value as ProfileFormState["peerSupport"])}
                style={inputStyle}
              >
                <option value="">请选择</option>
                {STUDENT_PEER_SUPPORT_VALUES.map((item) => (
                  <option key={item} value={item}>
                    {STUDENT_PEER_SUPPORT_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <Card title="个性与支持说明" tag="协同">
          <div className="feature-card">
            <EduIcon name="puzzle" />
            <p>让老师更了解你的优势和需要关注的点，方便课堂协作与微调座位安排。</p>
          </div>
          <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
            <label>
              <div className="section-title">个人优势</div>
              <textarea
                value={form.strengths}
                onChange={(event) => updateForm("strengths", event.target.value)}
                placeholder="例如：数学思维好、表达积极、乐于帮助同学"
                style={textareaStyle}
              />
            </label>
            <label>
              <div className="section-title">老师特别关注</div>
              <textarea
                value={form.supportNotes}
                onChange={(event) => updateForm("supportNotes", event.target.value)}
                placeholder="例如：希望坐前排、需要减少干扰、最近注意力波动"
                style={textareaStyle}
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
      </form>

      <Card title="家长绑定码" tag="家校">
        <div className="feature-card">
          <EduIcon name="rocket" />
          <p>提供给家长注册使用，绑定后可查看学习进展、通知与课堂节奏。</p>
        </div>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <div className="section-title" style={{ fontSize: 18 }}>
            {observerCode || "保存资料后自动生成"}
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={!observerCode}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(observerCode);
                setObserverCopied(true);
                setObserverMessage("已复制绑定码");
                setTimeout(() => setObserverCopied(false), 2000);
              } catch {
                setObserverCopied(false);
                setObserverMessage("复制失败，请手动复制");
              }
            }}
          >
            {observerCopied ? "已复制" : "复制绑定码"}
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={async () => {
              try {
                const res = await fetch("/api/student/observer-code", { method: "POST" });
                const data = (await res.json()) as ObserverCodeResponse & { error?: string };
                if (res.ok && data.data?.code) {
                  setObserverCode(data.data.code);
                  setObserverMessage("已生成新绑定码");
                } else {
                  setObserverMessage(data.error ?? "请先保存基础资料后再生成绑定码");
                }
              } catch {
                setObserverMessage("生成失败，请稍后再试");
              }
            }}
          >
            重新生成
          </button>
        </div>
        {observerMessage ? <div style={{ marginTop: 8, fontSize: 12 }}>{observerMessage}</div> : null}
      </Card>
    </div>
  );
}
