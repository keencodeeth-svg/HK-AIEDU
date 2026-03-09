export const STUDENT_GENDER_VALUES = ["male", "female", "other", "undisclosed"] as const;
export type StudentGender = (typeof STUDENT_GENDER_VALUES)[number];

export const STUDENT_EYESIGHT_LEVEL_VALUES = ["normal", "front_preferred"] as const;
export type StudentEyesightLevel = (typeof STUDENT_EYESIGHT_LEVEL_VALUES)[number];

export const STUDENT_SEAT_PREFERENCE_VALUES = ["front", "middle", "back", "flexible"] as const;
export type StudentSeatPreference = (typeof STUDENT_SEAT_PREFERENCE_VALUES)[number];

export const STUDENT_PERSONALITY_VALUES = ["quiet", "balanced", "active"] as const;
export type StudentPersonality = (typeof STUDENT_PERSONALITY_VALUES)[number];

export const STUDENT_FOCUS_SUPPORT_VALUES = ["needs_focus", "balanced", "self_driven"] as const;
export type StudentFocusSupport = (typeof STUDENT_FOCUS_SUPPORT_VALUES)[number];

export const STUDENT_PEER_SUPPORT_VALUES = ["needs_support", "balanced", "can_support"] as const;
export type StudentPeerSupport = (typeof STUDENT_PEER_SUPPORT_VALUES)[number];

export type StudentPersonaLike = {
  preferredName?: string;
  gender?: StudentGender;
  heightCm?: number;
  eyesightLevel?: StudentEyesightLevel;
  seatPreference?: StudentSeatPreference;
  personality?: StudentPersonality;
  focusSupport?: StudentFocusSupport;
  peerSupport?: StudentPeerSupport;
  strengths?: string;
  supportNotes?: string;
};

export const STUDENT_GENDER_LABELS: Record<StudentGender, string> = {
  male: "男",
  female: "女",
  other: "其他",
  undisclosed: "暂不透露"
};

export const STUDENT_EYESIGHT_LEVEL_LABELS: Record<StudentEyesightLevel, string> = {
  normal: "正常",
  front_preferred: "前排优先"
};

export const STUDENT_SEAT_PREFERENCE_LABELS: Record<StudentSeatPreference, string> = {
  front: "前排",
  middle: "中间",
  back: "后排",
  flexible: "灵活安排"
};

export const STUDENT_PERSONALITY_LABELS: Record<StudentPersonality, string> = {
  quiet: "安静型",
  balanced: "平衡型",
  active: "活跃型"
};

export const STUDENT_FOCUS_SUPPORT_LABELS: Record<StudentFocusSupport, string> = {
  needs_focus: "需要低干扰",
  balanced: "专注稳定",
  self_driven: "自驱专注"
};

export const STUDENT_PEER_SUPPORT_LABELS: Record<StudentPeerSupport, string> = {
  needs_support: "需要同伴支持",
  balanced: "协作均衡",
  can_support: "可带动同桌"
};

export const STUDENT_PERSONA_FIELD_LABELS: Record<keyof StudentPersonaLike, string> = {
  preferredName: "常用称呼",
  gender: "性别信息",
  heightCm: "身高",
  eyesightLevel: "视力/前排需求",
  seatPreference: "座位偏好",
  personality: "课堂性格",
  focusSupport: "专注支持",
  peerSupport: "同桌协作",
  strengths: "个人优势",
  supportNotes: "老师特别关注"
};

export const STUDENT_PERSONA_MUTABLE_FIELDS = [
  "preferredName",
  "gender",
  "heightCm",
  "eyesightLevel",
  "seatPreference",
  "personality",
  "focusSupport",
  "peerSupport",
  "strengths",
  "supportNotes"
] as const;

export type StudentPersonaMutableField = (typeof STUDENT_PERSONA_MUTABLE_FIELDS)[number];

function hasValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== undefined && value !== null;
}

export function calculateStudentPersonaCompleteness(persona?: Partial<StudentPersonaLike> | null) {
  const missingFields = STUDENT_PERSONA_MUTABLE_FIELDS.filter((field) => !hasValue(persona?.[field])).map(
    (field) => STUDENT_PERSONA_FIELD_LABELS[field]
  );
  const completedFields = STUDENT_PERSONA_MUTABLE_FIELDS.length - missingFields.length;
  const percentage = Math.round((completedFields / STUDENT_PERSONA_MUTABLE_FIELDS.length) * 100);

  return {
    completedFields,
    percentage,
    missingFields
  };
}

export function getStudentPersonaTags(persona?: Partial<StudentPersonaLike> | null) {
  if (!persona) return [] as string[];

  const tags: string[] = [];
  if (persona.gender) {
    tags.push(STUDENT_GENDER_LABELS[persona.gender]);
  }
  if (typeof persona.heightCm === "number" && Number.isFinite(persona.heightCm)) {
    tags.push(`${Math.round(persona.heightCm)}cm`);
  }
  if (persona.eyesightLevel) {
    tags.push(STUDENT_EYESIGHT_LEVEL_LABELS[persona.eyesightLevel]);
  }
  if (persona.seatPreference) {
    tags.push(STUDENT_SEAT_PREFERENCE_LABELS[persona.seatPreference]);
  }
  if (persona.personality) {
    tags.push(STUDENT_PERSONALITY_LABELS[persona.personality]);
  }
  if (persona.focusSupport) {
    tags.push(STUDENT_FOCUS_SUPPORT_LABELS[persona.focusSupport]);
  }
  if (persona.peerSupport) {
    tags.push(STUDENT_PEER_SUPPORT_LABELS[persona.peerSupport]);
  }

  return tags;
}
