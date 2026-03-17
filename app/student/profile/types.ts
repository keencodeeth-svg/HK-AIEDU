import type {
  STUDENT_EYESIGHT_LEVEL_VALUES,
  STUDENT_FOCUS_SUPPORT_VALUES,
  STUDENT_GENDER_VALUES,
  STUDENT_PERSONALITY_VALUES,
  STUDENT_PEER_SUPPORT_VALUES,
  STUDENT_SEAT_PREFERENCE_VALUES
} from "@/lib/student-persona-options";

export type StudentProfilePayload = {
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

export type ProfileResponse = { data?: StudentProfilePayload };

export type ObserverCodeResponse = {
  data?: {
    code?: string | null;
  };
};

export type StudentProfileSaveResponse = ProfileResponse & {
  error?: string;
};

export type ObserverCodeMutationResponse = ObserverCodeResponse & {
  error?: string;
};

export type StudentProfileFormState = {
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
