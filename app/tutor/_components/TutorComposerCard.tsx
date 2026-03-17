import Image from "next/image";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, Ref } from "react";
import Card from "@/components/Card";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import {
  ALLOWED_IMAGE_TYPES,
  ANSWER_MODE_OPTIONS,
  LEARNING_MODE_OPTIONS,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_MB
} from "../config";
import type { TutorAnswerMode } from "../types";
import type {
  ActiveAction,
  CropSelection,
  PreviewItem,
  TutorLearningMode
} from "../utils";
import {
  getCropSummary,
  hasCrop,
  shouldRenderCrop
} from "../utils";

type TutorComposerCardProps = {
  subject: string;
  grade: string;
  learningMode: TutorLearningMode;
  answerMode: TutorAnswerMode;
  question: string;
  studyThinking: string;
  launchIntent: "text" | "image" | "history" | null;
  selectedImages: File[];
  cropSelections: Array<CropSelection | null>;
  previewItems: PreviewItem[];
  selectedCropCount: number;
  questionInputRef: Ref<HTMLTextAreaElement>;
  loading: boolean;
  activeAction: ActiveAction;
  actionMessage: string | null;
  error: string | null;
  onSubjectChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onLearningModeChange: (value: TutorLearningMode) => void;
  onAnswerModeChange: (value: TutorAnswerMode) => void;
  onQuestionChange: (value: string) => void;
  onStudyThinkingChange: (value: string) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearSelectedImages: () => void;
  onClearCropSelection: (index: number) => void;
  onRemoveSelectedImage: (index: number) => void;
  onCropPointerDown: (index: number, event: ReactPointerEvent<HTMLDivElement>) => void;
  onCropPointerMove: (index: number, event: ReactPointerEvent<HTMLDivElement>) => void;
  onCropPointerFinish: (index: number, event: ReactPointerEvent<HTMLDivElement>) => void;
  onAsk: () => void;
  onStartStudyMode: () => void;
  onImageAsk: () => void;
};

export function TutorComposerCard({
  subject,
  grade,
  learningMode,
  answerMode,
  question,
  studyThinking,
  launchIntent,
  selectedImages,
  cropSelections,
  previewItems,
  selectedCropCount,
  questionInputRef,
  loading,
  activeAction,
  actionMessage,
  error,
  onSubjectChange,
  onGradeChange,
  onLearningModeChange,
  onAnswerModeChange,
  onQuestionChange,
  onStudyThinkingChange,
  onImageSelect,
  onClearSelectedImages,
  onClearCropSelection,
  onRemoveSelectedImage,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerFinish,
  onAsk,
  onStartStudyMode,
  onImageAsk
}: TutorComposerCardProps) {
  const selectedLearningMode = LEARNING_MODE_OPTIONS.find((item) => item.value === learningMode) ?? LEARNING_MODE_OPTIONS[0];
  const selectedAnswerMode = ANSWER_MODE_OPTIONS.find((item) => item.value === answerMode) ?? ANSWER_MODE_OPTIONS[1];

  return (
    <>
      <div id="tutor-composer-anchor" />
      <Card title="AI 辅导 / 拍照识题" tag="提问">
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid grid-3">
            <label>
              <div className="section-title">学科</div>
              <select
                value={subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {SUBJECT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">年级</div>
              <select
                value={grade}
                onChange={(event) => onGradeChange(event.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {GRADE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="card tutor-image-status-card" style={{ minHeight: 84, display: "grid", alignContent: "center" }}>
              <div className="section-title">题图状态</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                已选 {selectedImages.length} / {MAX_IMAGE_COUNT} 张题图{selectedCropCount ? ` · 已框选 ${selectedCropCount} 张` : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                {selectedImages.length
                  ? question.trim()
                    ? learningMode === "study"
                      ? "可直接进入学习模式，当前文字会作为补充说明。"
                      : "可直接开始识题，当前文字会作为补充说明。"
                    : learningMode === "study"
                      ? "可先识别题目，再进入学习模式。"
                      : "可直接开始识题，也可以先补充一句文字说明。"
                  : learningMode === "study"
                    ? selectedLearningMode.description
                    : selectedAnswerMode.description}
              </div>
            </div>
          </div>

          <div className="grid" style={{ gap: 8 }}>
            <div className="section-title">交互模式</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8
              }}
            >
              {LEARNING_MODE_OPTIONS.map((option) => {
                const selected = option.value === learningMode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="button secondary"
                    aria-pressed={selected}
                    onClick={() => onLearningModeChange(option.value)}
                    style={{
                      minHeight: 64,
                      justifyContent: "flex-start",
                      textAlign: "left",
                      borderColor: selected ? "var(--brand, #6366f1)" : undefined,
                      background: selected ? "rgba(99, 102, 241, 0.08)" : undefined
                    }}
                  >
                    <span style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontWeight: 600 }}>{option.label}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {learningMode === "direct" ? (
            <div className="grid" style={{ gap: 8 }}>
              <div className="section-title">答案模式</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 8
                }}
              >
                {ANSWER_MODE_OPTIONS.map((option) => {
                  const selected = option.value === answerMode;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="button secondary"
                      aria-pressed={selected}
                      onClick={() => onAnswerModeChange(option.value)}
                      style={{
                        minHeight: 56,
                        justifyContent: "flex-start",
                        textAlign: "left",
                        borderColor: selected ? "var(--brand, #6366f1)" : undefined,
                        background: selected ? "rgba(99, 102, 241, 0.08)" : undefined
                      }}
                    >
                      <span style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>{option.label}</span>
                        <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="status-note info" style={{ marginTop: -2 }}>
              学习模式会先给提示、追问和知识检查；只有在你需要时，才揭晓完整讲解。
            </div>
          )}

          <label>
            <div className="section-title">{learningMode === "study" ? "输入题目或学习任务" : "输入你的问题或补充说明"}</div>
            <textarea
              ref={questionInputRef}
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              rows={4}
              placeholder={
                learningMode === "study"
                  ? "例如：我想先自己做，请用学习模式带我做这道题；如果识别有误，以我输入的文字为准。"
                  : "例如：如果识别有误，请以我输入的文字为准；或者要求只给答案。"
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>

          {learningMode === "study" ? (
            <label>
              <div className="section-title">先写下你的想法（可选）</div>
              <textarea
                value={studyThinking}
                onChange={(event) => onStudyThinkingChange(event.target.value)}
                rows={3}
                placeholder="例如：我觉得应该先找已知条件，再判断用哪个公式。"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          ) : null}

          <div className="status-note" style={{ marginTop: -4 }}>
            {learningMode === "study"
              ? "支持一题多图。学习模式会先识别题目，再通过提示、追问和知识检查推进。"
              : "支持一题多图，适合题干较长、图形题、选项与题干分开拍摄的场景。"}
          </div>

          <div
            className="card"
            style={{
              display: "grid",
              gap: 12,
              borderColor: launchIntent === "image" ? "rgba(99, 102, 241, 0.36)" : undefined,
              boxShadow: launchIntent === "image" ? "0 16px 40px rgba(99, 102, 241, 0.08)" : undefined
            }}
          >
            <div>
              <div className="section-title">{learningMode === "study" ? "拍照识题后进入学习模式" : "拍照或上传题目图片"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                {learningMode === "study"
                  ? "在图片上按住并拖拽框出题目区域；识别完成后会先进入提示与追问，而不是直接给答案。"
                  : "在图片上按住并拖拽框出题目区域；不框选时默认上传原图。"}
              </div>
            </div>

            <div className="cta-row">
              <label className="button secondary" style={{ cursor: "pointer", minHeight: 44 }}>
                {selectedImages.length ? "继续添加图片" : "选择图片"}
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  capture="environment"
                  onChange={onImageSelect}
                  style={{ display: "none" }}
                />
              </label>
              <button className="button secondary" onClick={onClearSelectedImages} disabled={loading || !selectedImages.length}>
                清空图片
              </button>
              <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                最多 {MAX_IMAGE_COUNT} 张，每张不超过 {MAX_IMAGE_SIZE_MB}MB
              </span>
            </div>

            {previewItems.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12
                }}
              >
                {previewItems.map((previewItem, index) => {
                  const selection = cropSelections[index] ?? null;
                  return (
                    <div key={`${selectedImages[index]?.name ?? "preview"}-${index}`} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div className="section-title">第 {index + 1} 张 · {selectedImages[index]?.name ?? "题图"}</div>
                        <span className="pill">{getCropSummary(selection)}</span>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6, marginBottom: 8 }}>
                        可重复拖拽重新框选；如果不满意，点击“清除框选”后再试一次。
                      </div>

                      <div
                        style={{
                          position: "relative",
                          borderRadius: 16,
                          overflow: "hidden",
                          border: "1px solid var(--stroke)",
                          background: "rgba(255,255,255,0.72)"
                        }}
                      >
                        <Image
                          src={previewItem.url}
                          alt={`待识别题目预览 ${index + 1}`}
                          width={previewItem.width}
                          height={previewItem.height}
                          unoptimized
                          style={{ width: "100%", height: "auto", display: "block" }}
                        />
                        <div
                          role="presentation"
                          onPointerDown={(event) => onCropPointerDown(index, event)}
                          onPointerMove={(event) => onCropPointerMove(index, event)}
                          onPointerUp={(event) => onCropPointerFinish(index, event)}
                          onPointerCancel={(event) => onCropPointerFinish(index, event)}
                          style={{
                            position: "absolute",
                            inset: 0,
                            cursor: loading ? "not-allowed" : "crosshair",
                            touchAction: "none"
                          }}
                        />
                        {shouldRenderCrop(selection) ? (
                          <div
                            style={{
                              position: "absolute",
                              left: `${selection!.x}%`,
                              top: `${selection!.y}%`,
                              width: `${selection!.width}%`,
                              height: `${selection!.height}%`,
                              borderRadius: 12,
                              border: "2px solid var(--brand, #6366f1)",
                              background: "rgba(99, 102, 241, 0.14)",
                              boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.22)",
                              pointerEvents: "none"
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="cta-row" style={{ marginTop: 10 }}>
                        <button
                          className="button secondary"
                          onClick={() => onClearCropSelection(index)}
                          disabled={loading || !hasCrop(selection)}
                        >
                          清除框选
                        </button>
                        <button className="button secondary" onClick={() => onRemoveSelectedImage(index)} disabled={loading}>
                          移除这张
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="cta-row">
            {learningMode === "study" ? (
              <>
                <button
                  className={launchIntent === "image" ? "button secondary" : "button primary"}
                  onClick={onStartStudyMode}
                  disabled={loading || (!question.trim() && !selectedImages.length)}
                >
                  {activeAction === "study" || activeAction === "study_image"
                    ? selectedImages.length
                      ? "进入学习模式中..."
                      : "启动学习模式中..."
                    : selectedImages.length
                      ? `拍照进入学习模式（${selectedImages.length}）`
                      : question.trim()
                        ? "开始学习模式"
                        : "学习模式"}
                </button>
                <button className="button secondary" type="button" onClick={onAsk} disabled={loading || !question.trim()}>
                  按文字直接讲解
                </button>
              </>
            ) : (
              <>
                <button
                  className={launchIntent === "image" ? "button secondary" : "button primary"}
                  onClick={onAsk}
                  disabled={loading || !question.trim()}
                >
                  {activeAction === "text" ? "思考中..." : question.trim() ? "按文字求解" : "文字提问"}
                </button>
                <button
                  className={launchIntent === "image" ? "button primary" : "button secondary"}
                  onClick={onImageAsk}
                  disabled={loading || !selectedImages.length}
                >
                  {activeAction === "image" ? "识题中..." : selectedImages.length ? `拍照识题（${selectedImages.length}）` : "拍照识题"}
                </button>
              </>
            )}
            <a className="button ghost" href="#tutor-history-anchor">看历史</a>
          </div>

          {actionMessage ? (
            <div className="status-note success" style={{ marginTop: 4 }}>
              {actionMessage}
            </div>
          ) : null}

          {error ? (
            <div className="status-note error" style={{ marginTop: 4 }}>
              {error}
            </div>
          ) : null}

        </div>
      </Card>
    </>
  );
}
