import type { PointerEvent as ReactPointerEvent } from "react";
import type { TutorLaunchIntent, TutorLaunchPanel } from "@/lib/tutor-launch";
import {
  ANSWER_MODE_OPTIONS,
  HISTORY_ORIGIN_LABELS,
  MIN_CROP_PERCENT
} from "./config";
import type {
  TutorAnswer,
  TutorAnswerMode,
  TutorHistoryOrigin,
  TutorShareTarget
} from "./types";

export type ActiveAction = "text" | "image" | "refine" | "study" | "study_image" | null;
export type TutorLearningMode = "direct" | "study";
export type ResultOrigin = TutorHistoryOrigin | null;
export type CropSelection = { x: number; y: number; width: number; height: number };
export type DragState = { index: number; startX: number; startY: number } | null;
export type PreviewItem = { url: string; width: number; height: number };
export type StudyQuestionResolution = { question: string; origin: TutorHistoryOrigin; imageCount: number };

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function buildSelection(startX: number, startY: number, endX: number, endY: number): CropSelection {
  const x = clampPercent(Math.min(startX, endX));
  const y = clampPercent(Math.min(startY, endY));
  const maxX = clampPercent(Math.max(startX, endX));
  const maxY = clampPercent(Math.max(startY, endY));
  return {
    x,
    y,
    width: Math.max(0, maxX - x),
    height: Math.max(0, maxY - y)
  };
}

export function hasCrop(selection: CropSelection | null | undefined) {
  return Boolean(selection && selection.width >= MIN_CROP_PERCENT && selection.height >= MIN_CROP_PERCENT);
}

export function shouldRenderCrop(selection: CropSelection | null | undefined) {
  return Boolean(selection && selection.width > 0.5 && selection.height > 0.5);
}

export function getCropSummary(selection: CropSelection | null | undefined) {
  if (!hasCrop(selection)) {
    return "整图上传";
  }

  return `已框选 ${Math.round(selection!.width)}% × ${Math.round(selection!.height)}%`;
}

export function getPointerPercent(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  return {
    x: clampPercent(x),
    y: clampPercent(y)
  };
}

export function getAnswerSections(answer: TutorAnswer, answerMode: TutorAnswerMode) {
  if (answer.learningMode === "study") {
    return [];
  }

  if (answerMode === "answer_only") {
    return [];
  }

  if (answerMode === "hints_first") {
    return [
      { key: "hints", title: "提示", items: answer.hints ?? [] },
      { key: "steps", title: "步骤", items: answer.steps ?? [] }
    ];
  }

  return [
    { key: "steps", title: "步骤", items: answer.steps ?? [] },
    { key: "hints", title: "提示", items: answer.hints ?? [] }
  ];
}

export function readImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image load failed"));
    };
    image.src = objectUrl;
  });
}

export async function cropImageFile(file: File, selection: CropSelection | null | undefined) {
  if (!hasCrop(selection)) {
    return file;
  }

  const image = await readImageFromFile(file);
  const cropX = Math.floor((image.naturalWidth * selection!.x) / 100);
  const cropY = Math.floor((image.naturalHeight * selection!.y) / 100);
  const cropWidth = Math.max(1, Math.floor((image.naturalWidth * selection!.width) / 100));
  const cropHeight = Math.max(1, Math.floor((image.naturalHeight * selection!.height) / 100));

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type || "image/png", 0.92);
  });

  if (!blob) {
    return file;
  }

  const dotIndex = file.name.lastIndexOf(".");
  const fileName = dotIndex >= 0 ? `${file.name.slice(0, dotIndex)}-crop${file.name.slice(dotIndex)}` : `${file.name}-crop`;
  return new File([blob], fileName, {
    type: blob.type || file.type,
    lastModified: Date.now()
  });
}

export async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function getOriginLabel(origin?: TutorHistoryOrigin | null) {
  if (!origin) return "文字求解";
  return HISTORY_ORIGIN_LABELS[origin] ?? "文字求解";
}

export function getQualityToneClass(riskLevel?: "low" | "medium" | "high") {
  if (riskLevel === "high") return "error";
  if (riskLevel === "medium") return "info";
  return "success";
}

export function isStudyResult(answer: TutorAnswer | null | undefined) {
  return answer?.learningMode === "study";
}

export function truncateText(value: string, maxLength = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

export function isTutorAnswerMode(value: string | null): value is TutorAnswerMode {
  return ANSWER_MODE_OPTIONS.some((item) => item.value === value);
}

export function getShareTargetActionLabel(target: TutorShareTarget) {
  return target.kind === "teacher" ? `发给老师 · ${target.name}` : `发给家长 · ${target.name}`;
}

export function isTutorLaunchIntent(value: string | null): value is TutorLaunchIntent {
  return value === "text" || value === "image" || value === "history";
}

export function isTutorLaunchPanel(value: string | null): value is TutorLaunchPanel {
  return value === "composer" || value === "history" || value === "answer";
}
