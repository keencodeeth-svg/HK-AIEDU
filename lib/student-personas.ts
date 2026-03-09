import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import type {
  StudentEyesightLevel,
  StudentFocusSupport,
  StudentGender,
  StudentPersonaLike,
  StudentPersonality,
  StudentPeerSupport,
  StudentSeatPreference
} from "./student-persona-options";

export type StudentPersona = StudentPersonaLike & {
  id: string;
  userId: string;
  updatedAt: string;
};

type StudentPersonaUpsertInput = {
  userId: string;
  preferredName?: string | null;
  gender?: StudentGender | null;
  heightCm?: number | null;
  eyesightLevel?: StudentEyesightLevel | null;
  seatPreference?: StudentSeatPreference | null;
  personality?: StudentPersonality | null;
  focusSupport?: StudentFocusSupport | null;
  peerSupport?: StudentPeerSupport | null;
  strengths?: string | null;
  supportNotes?: string | null;
};

const FILE = "student-personas.json";

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length ? next : undefined;
}

function normalizeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

export async function getStudentPersonas(): Promise<StudentPersona[]> {
  return readJson<StudentPersona[]>(FILE, []);
}

export async function getStudentPersona(userId: string) {
  const list = await getStudentPersonas();
  return list.find((item) => item.userId === userId) ?? null;
}

export async function listStudentPersonasByUserIds(userIds: string[]) {
  if (!userIds.length) return [] as StudentPersona[];
  const userIdSet = new Set(userIds);
  const list = await getStudentPersonas();
  return list.filter((item) => userIdSet.has(item.userId));
}

export async function upsertStudentPersona(input: StudentPersonaUpsertInput): Promise<StudentPersona> {
  const list = await getStudentPersonas();
  const index = list.findIndex((item) => item.userId === input.userId);
  const existing = index >= 0 ? list[index] : null;
  const updatedAt = new Date().toISOString();

  const next: StudentPersona = {
    id: existing?.id ?? `persona-${crypto.randomBytes(6).toString("hex")}`,
    userId: input.userId,
    preferredName: input.preferredName !== undefined ? normalizeText(input.preferredName) : existing?.preferredName,
    gender: input.gender !== undefined ? input.gender ?? undefined : existing?.gender,
    heightCm: input.heightCm !== undefined ? normalizeNumber(input.heightCm) : existing?.heightCm,
    eyesightLevel:
      input.eyesightLevel !== undefined ? input.eyesightLevel ?? undefined : existing?.eyesightLevel,
    seatPreference:
      input.seatPreference !== undefined ? input.seatPreference ?? undefined : existing?.seatPreference,
    personality: input.personality !== undefined ? input.personality ?? undefined : existing?.personality,
    focusSupport: input.focusSupport !== undefined ? input.focusSupport ?? undefined : existing?.focusSupport,
    peerSupport: input.peerSupport !== undefined ? input.peerSupport ?? undefined : existing?.peerSupport,
    strengths: input.strengths !== undefined ? normalizeText(input.strengths) : existing?.strengths,
    supportNotes:
      input.supportNotes !== undefined ? normalizeText(input.supportNotes) : existing?.supportNotes,
    updatedAt
  };

  if (index >= 0) {
    list[index] = next;
  } else {
    list.push(next);
  }

  writeJson(FILE, list);
  return next;
}
