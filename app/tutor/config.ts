import type { TutorAnswerMode, TutorHistoryOrigin, TutorHistoryOriginFilter } from "./types";

export const DEFAULT_SUBJECT = "math";
export const DEFAULT_GRADE = "4";
export const DEFAULT_ANSWER_MODE: TutorAnswerMode = "step_by_step";
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_COUNT = 3;
export const MIN_CROP_PERCENT = 2;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const ANSWER_MODE_OPTIONS = [
  {
    value: "answer_only",
    label: "只要答案",
    description: "快速核对结果，不展开步骤。"
  },
  {
    value: "step_by_step",
    label: "分步讲解",
    description: "适合完整学会这道题。"
  },
  {
    value: "hints_first",
    label: "先提示后答案",
    description: "先自己思考，再看答案。"
  }
] as const;

export const LEARNING_MODE_OPTIONS = [
  {
    value: "direct",
    label: "直接讲解",
    description: "像常规 AI 解题一样，快速得到答案与讲解。"
  },
  {
    value: "study",
    label: "学习模式",
    description: "先提示和追问，再让你说思路，最后按需揭晓完整讲解。"
  }
] as const;

export const HISTORY_ORIGIN_OPTIONS: Array<{ value: TutorHistoryOriginFilter; label: string }> = [
  { value: "all", label: "全部来源" },
  { value: "image", label: "图片识题" },
  { value: "text", label: "文字求解" },
  { value: "refine", label: "编辑重算" }
];

export const HISTORY_ORIGIN_LABELS: Record<TutorHistoryOrigin, string> = {
  text: "文字求解",
  image: "图片识题",
  refine: "编辑重算"
};

export const QUALITY_RISK_LABELS = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
} as const;
