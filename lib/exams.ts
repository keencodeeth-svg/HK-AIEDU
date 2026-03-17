import crypto from "crypto";
import { readJson, transactJsonFiles, updateJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";
import { getClassStudentIds } from "./classes";

export type ExamPaperStatus = "published" | "closed";
export type ExamAssignmentStatus = "pending" | "in_progress" | "submitted";
export type ExamPublishMode = "teacher_assigned" | "targeted";
export type ExamAntiCheatLevel = "off" | "basic";

export type ExamPaper = {
  id: string;
  classId: string;
  title: string;
  description?: string;
  publishMode: ExamPublishMode;
  antiCheatLevel: ExamAntiCheatLevel;
  startAt?: string;
  endAt: string;
  durationMinutes?: number;
  status: ExamPaperStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExamPaperItem = {
  id: string;
  paperId: string;
  questionId: string;
  score: number;
  orderIndex: number;
};

export type ExamAssignment = {
  id: string;
  paperId: string;
  studentId: string;
  status: ExamAssignmentStatus;
  assignedAt: string;
  startedAt?: string;
  autoSavedAt?: string;
  submittedAt?: string;
  score?: number;
  total?: number;
};

export type ExamAnswerDraft = {
  id: string;
  paperId: string;
  studentId: string;
  answers: Record<string, string>;
  updatedAt: string;
};

export type ExamSubmission = {
  id: string;
  paperId: string;
  studentId: string;
  answers: Record<string, string>;
  score: number;
  total: number;
  submittedAt: string;
};

const EXAM_PAPER_FILE = "exam-papers.json";
const EXAM_PAPER_ITEM_FILE = "exam-paper-items.json";
const EXAM_ASSIGNMENT_FILE = "exam-assignments.json";
const EXAM_ANSWER_FILE = "exam-answers.json";
const EXAM_SUBMISSION_FILE = "exam-submissions.json";

type DbExamPaper = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  publish_mode: string | null;
  anti_cheat_level: string | null;
  start_at: string | null;
  end_at: string;
  duration_minutes: number | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DbExamPaperItem = {
  id: string;
  paper_id: string;
  question_id: string;
  score: number | null;
  order_index: number | null;
};

type DbExamAssignment = {
  id: string;
  paper_id: string;
  student_id: string;
  status: string;
  assigned_at: string;
  started_at: string | null;
  auto_saved_at: string | null;
  submitted_at: string | null;
  score: number | null;
  total: number | null;
};

type DbExamAnswer = {
  id: string;
  paper_id: string;
  student_id: string;
  answers: any;
  updated_at: string;
};

type DbExamSubmission = {
  id: string;
  paper_id: string;
  student_id: string;
  answers: any;
  score: number;
  total: number;
  submitted_at: string;
};

function normalizeExamPaper(paper: ExamPaper): ExamPaper {
  return {
    ...paper,
    publishMode: paper.publishMode ?? "teacher_assigned",
    antiCheatLevel: paper.antiCheatLevel ?? "basic",
    status: paper.status ?? "published"
  };
}

function parseAnswers(input: unknown): Record<string, string> {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      return parseAnswers(parsed);
    } catch {
      return {};
    }
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const next: Record<string, string> = {};
  Object.entries(input as Record<string, unknown>).forEach(([questionId, value]) => {
    if (typeof value === "string") {
      next[questionId] = value;
    }
  });
  return next;
}

function mapExamPaper(row: DbExamPaper): ExamPaper {
  const publishMode = (row.publish_mode as ExamPublishMode | null) ?? "teacher_assigned";
  const antiCheatLevel = (row.anti_cheat_level as ExamAntiCheatLevel | null) ?? "basic";
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    description: row.description ?? undefined,
    publishMode,
    antiCheatLevel,
    startAt: row.start_at ?? undefined,
    endAt: row.end_at,
    durationMinutes: row.duration_minutes ?? undefined,
    status: (row.status as ExamPaperStatus | null) ?? "published",
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapExamPaperItem(row: DbExamPaperItem): ExamPaperItem {
  return {
    id: row.id,
    paperId: row.paper_id,
    questionId: row.question_id,
    score: row.score ?? 1,
    orderIndex: row.order_index ?? 0
  };
}

function mapExamAssignment(row: DbExamAssignment): ExamAssignment {
  return {
    id: row.id,
    paperId: row.paper_id,
    studentId: row.student_id,
    status: row.status as ExamAssignmentStatus,
    assignedAt: row.assigned_at,
    startedAt: row.started_at ?? undefined,
    autoSavedAt: row.auto_saved_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    score: row.score ?? undefined,
    total: row.total ?? undefined
  };
}

function mapExamAnswer(row: DbExamAnswer): ExamAnswerDraft {
  return {
    id: row.id,
    paperId: row.paper_id,
    studentId: row.student_id,
    answers: parseAnswers(row.answers),
    updatedAt: row.updated_at
  };
}

function mapExamSubmission(row: DbExamSubmission): ExamSubmission {
  return {
    id: row.id,
    paperId: row.paper_id,
    studentId: row.student_id,
    answers: parseAnswers(row.answers),
    score: row.score,
    total: row.total,
    submittedAt: row.submitted_at
  };
}

function canUseApiTestExamExecutionFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireExamAssignmentsDatabase() {
  requireDatabaseEnabled("exam_assignments");
}

function requireExamAnswersDatabase() {
  requireDatabaseEnabled("exam_answers");
}

function requireExamSubmissionsDatabase() {
  requireDatabaseEnabled("exam_submissions");
}

export async function getExamPapers(): Promise<ExamPaper[]> {
  if (!isDbEnabled()) {
    const list = readJson<ExamPaper[]>(EXAM_PAPER_FILE, []);
    return [...list].map(normalizeExamPaper).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await query<DbExamPaper>("SELECT * FROM exam_papers ORDER BY created_at DESC");
  return rows.map(mapExamPaper);
}

export async function getExamPaperById(id: string): Promise<ExamPaper | null> {
  if (!isDbEnabled()) {
    const list = await getExamPapers();
    return list.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbExamPaper>("SELECT * FROM exam_papers WHERE id = $1", [id]);
  return row ? mapExamPaper(row) : null;
}

export async function getExamPapersByClassIds(classIds: string[]): Promise<ExamPaper[]> {
  if (!classIds.length) return [];
  if (!isDbEnabled()) {
    return (await getExamPapers()).filter((item) => classIds.includes(item.classId));
  }
  const rows = await query<DbExamPaper>(
    "SELECT * FROM exam_papers WHERE class_id = ANY($1) ORDER BY created_at DESC",
    [classIds]
  );
  return rows.map(mapExamPaper);
}

export async function getExamPaperItems(paperId: string): Promise<ExamPaperItem[]> {
  if (!isDbEnabled()) {
    const list = readJson<ExamPaperItem[]>(EXAM_PAPER_ITEM_FILE, []);
    return list
      .filter((item) => item.paperId === paperId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }
  const rows = await query<DbExamPaperItem>(
    "SELECT * FROM exam_paper_items WHERE paper_id = $1 ORDER BY order_index ASC",
    [paperId]
  );
  return rows.map(mapExamPaperItem);
}

export async function getExamAssignment(paperId: string, studentId: string): Promise<ExamAssignment | null> {
  if (canUseApiTestExamExecutionFallback()) {
    const list = readJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, []);
    return list.find((item) => item.paperId === paperId && item.studentId === studentId) ?? null;
  }
  requireExamAssignmentsDatabase();
  const row = await queryOne<DbExamAssignment>(
    "SELECT * FROM exam_assignments WHERE paper_id = $1 AND student_id = $2",
    [paperId, studentId]
  );
  return row ? mapExamAssignment(row) : null;
}

export async function getExamAssignmentsByPaper(paperId: string): Promise<ExamAssignment[]> {
  if (canUseApiTestExamExecutionFallback()) {
    const list = readJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, []);
    return list.filter((item) => item.paperId === paperId);
  }
  requireExamAssignmentsDatabase();
  const rows = await query<DbExamAssignment>(
    "SELECT * FROM exam_assignments WHERE paper_id = $1 ORDER BY assigned_at ASC",
    [paperId]
  );
  return rows.map(mapExamAssignment);
}

export async function getExamAssignmentsByStudent(studentId: string): Promise<ExamAssignment[]> {
  if (canUseApiTestExamExecutionFallback()) {
    const list = readJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, []);
    return list.filter((item) => item.studentId === studentId);
  }
  requireExamAssignmentsDatabase();
  const rows = await query<DbExamAssignment>(
    "SELECT * FROM exam_assignments WHERE student_id = $1 ORDER BY assigned_at DESC",
    [studentId]
  );
  return rows.map(mapExamAssignment);
}

export async function ensureExamAssignment(paperId: string, studentId: string): Promise<ExamAssignment> {
  const existing = await getExamAssignment(paperId, studentId);
  if (existing) return existing;

  const assignedAt = new Date().toISOString();
  const assignment: ExamAssignment = {
    id: `exam-assign-${crypto.randomBytes(6).toString("hex")}`,
    paperId,
    studentId,
    status: "pending",
    assignedAt
  };

  if (canUseApiTestExamExecutionFallback()) {
    return updateJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, [], (list) => {
      const exists = list.some((item) => item.paperId === paperId && item.studentId === studentId);
      if (!exists) {
        list.push(assignment);
      }
      return list;
    }).then(
      (list) => list.find((item) => item.paperId === paperId && item.studentId === studentId) ?? assignment
    );
  }

  requireExamAssignmentsDatabase();
  const row = await queryOne<DbExamAssignment>(
    `INSERT INTO exam_assignments (id, paper_id, student_id, status, assigned_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (paper_id, student_id) DO NOTHING
     RETURNING *`,
    [assignment.id, paperId, studentId, assignment.status, assignedAt]
  );

  if (row) return mapExamAssignment(row);
  const fallback = await getExamAssignment(paperId, studentId);
  return fallback ?? assignment;
}

export async function ensureExamAssignmentsForPaper(paperId: string): Promise<ExamAssignment[]> {
  const paper = await getExamPaperById(paperId);
  if (!paper) return [];

  if (paper.publishMode === "targeted") {
    // Targeted publish already writes explicit assignees; do not auto-expand by class roster.
    return getExamAssignmentsByPaper(paperId);
  }

  // Teacher-assigned mode lazily syncs assignments with current class roster.
  const students = await getClassStudentIds(paper.classId);
  if (!students.length) {
    return getExamAssignmentsByPaper(paperId);
  }

  const existing = await getExamAssignmentsByPaper(paperId);
  const assignedSet = new Set(existing.map((item) => item.studentId));
  const missing = students.filter((studentId) => !assignedSet.has(studentId));

  if (!missing.length) return existing;

  const assignedAt = new Date().toISOString();
  if (canUseApiTestExamExecutionFallback()) {
    return updateJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, [], (list) => {
      const assignedSet = new Set(
        list.filter((item) => item.paperId === paperId).map((item) => item.studentId)
      );
      missing.forEach((studentId) => {
        if (!assignedSet.has(studentId)) {
          list.push({
            id: `exam-assign-${crypto.randomBytes(6).toString("hex")}`,
            paperId,
            studentId,
            status: "pending",
            assignedAt
          });
        }
      });
      return list;
    }).then((list) => list.filter((item) => item.paperId === paperId));
  }

  requireExamAssignmentsDatabase();
  for (const studentId of missing) {
    await query(
      `INSERT INTO exam_assignments (id, paper_id, student_id, status, assigned_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (paper_id, student_id) DO NOTHING`,
      [`exam-assign-${crypto.randomBytes(6).toString("hex")}`, paperId, studentId, "pending", assignedAt]
    );
  }

  return getExamAssignmentsByPaper(paperId);
}

export async function getExamAnswerDraft(paperId: string, studentId: string): Promise<ExamAnswerDraft | null> {
  if (canUseApiTestExamExecutionFallback()) {
    const list = readJson<ExamAnswerDraft[]>(EXAM_ANSWER_FILE, []);
    return list.find((item) => item.paperId === paperId && item.studentId === studentId) ?? null;
  }
  requireExamAnswersDatabase();
  const row = await queryOne<DbExamAnswer>(
    "SELECT * FROM exam_answers WHERE paper_id = $1 AND student_id = $2",
    [paperId, studentId]
  );
  return row ? mapExamAnswer(row) : null;
}

export async function upsertExamAnswerDraft(input: {
  paperId: string;
  studentId: string;
  answers: Record<string, string>;
}): Promise<ExamAnswerDraft> {
  const updatedAt = new Date().toISOString();

  if (canUseApiTestExamExecutionFallback()) {
    const next: ExamAnswerDraft = {
      id: `exam-answer-${crypto.randomBytes(6).toString("hex")}`,
      paperId: input.paperId,
      studentId: input.studentId,
      answers: input.answers,
      updatedAt
    };
    return updateJson<ExamAnswerDraft[]>(EXAM_ANSWER_FILE, [], (list) => {
      const index = list.findIndex((item) => item.paperId === input.paperId && item.studentId === input.studentId);
      if (index >= 0) {
        next.id = list[index].id;
        list[index] = next;
      } else {
        list.push(next);
      }
      return list;
    }).then(
      (list) => list.find((item) => item.paperId === input.paperId && item.studentId === input.studentId) ?? next
    );
  }

  requireExamAnswersDatabase();
  const id = `exam-answer-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbExamAnswer>(
    `INSERT INTO exam_answers (id, paper_id, student_id, answers, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (paper_id, student_id) DO UPDATE SET
       answers = EXCLUDED.answers,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, input.paperId, input.studentId, input.answers, updatedAt]
  );

  return row
    ? mapExamAnswer(row)
    : {
        id,
        paperId: input.paperId,
        studentId: input.studentId,
        answers: input.answers,
        updatedAt
      };
}

export async function getExamSubmission(paperId: string, studentId: string): Promise<ExamSubmission | null> {
  if (canUseApiTestExamExecutionFallback()) {
    const list = readJson<ExamSubmission[]>(EXAM_SUBMISSION_FILE, []);
    return list.find((item) => item.paperId === paperId && item.studentId === studentId) ?? null;
  }
  requireExamSubmissionsDatabase();
  const row = await queryOne<DbExamSubmission>(
    "SELECT * FROM exam_submissions WHERE paper_id = $1 AND student_id = $2",
    [paperId, studentId]
  );
  return row ? mapExamSubmission(row) : null;
}

export async function getExamSubmissionsByPaper(paperId: string): Promise<ExamSubmission[]> {
  if (canUseApiTestExamExecutionFallback()) {
    const list = readJson<ExamSubmission[]>(EXAM_SUBMISSION_FILE, []);
    return list.filter((item) => item.paperId === paperId);
  }
  requireExamSubmissionsDatabase();
  const rows = await query<DbExamSubmission>(
    "SELECT * FROM exam_submissions WHERE paper_id = $1 ORDER BY submitted_at DESC",
    [paperId]
  );
  return rows.map(mapExamSubmission);
}

export async function createAndPublishExam(input: {
  classId: string;
  title: string;
  description?: string;
  publishMode?: ExamPublishMode;
  antiCheatLevel?: ExamAntiCheatLevel;
  assignedStudentIds?: string[];
  startAt?: string;
  endAt: string;
  durationMinutes?: number;
  createdBy?: string;
  questionIds: string[];
  scorePerQuestion?: number;
}): Promise<ExamPaper> {
  const now = new Date().toISOString();
  const id = `exam-paper-${crypto.randomBytes(6).toString("hex")}`;
  const scorePerQuestion = Math.max(1, Number(input.scorePerQuestion ?? 1));
  // Keep exam paper deterministic even if caller passes duplicate questionIds/studentIds.
  const uniqueQuestionIds = Array.from(new Set(input.questionIds)).filter((questionId) => questionId.trim());
  const publishMode = input.publishMode ?? "teacher_assigned";
  const antiCheatLevel = input.antiCheatLevel ?? "basic";
  const assignedStudentIds = Array.from(new Set(input.assignedStudentIds ?? []));
  const paper: ExamPaper = {
    id,
    classId: input.classId,
    title: input.title,
    description: input.description,
    publishMode,
    antiCheatLevel,
    startAt: input.startAt,
    endAt: input.endAt,
    durationMinutes: input.durationMinutes,
    status: "published",
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  };

  if (!isDbEnabled()) {
    if (!canUseApiTestExamExecutionFallback()) {
      requireExamAssignmentsDatabase();
    }
    const students = await getClassStudentIds(input.classId);
    // Guard against stale/invalid student ids by intersecting with class membership.
    const targetStudents =
      publishMode === "targeted" ? assignedStudentIds.filter((id) => students.includes(id)) : students;
    await transactJsonFiles<{
      papers: ExamPaper[];
      items: ExamPaperItem[];
      assignments: ExamAssignment[];
    }, void>(
      {
        papers: { fileName: EXAM_PAPER_FILE, fallback: [] },
        items: { fileName: EXAM_PAPER_ITEM_FILE, fallback: [] },
        assignments: { fileName: EXAM_ASSIGNMENT_FILE, fallback: [] }
      },
      ({ papers, items, assignments }) => {
        papers.push(paper);
        uniqueQuestionIds.forEach((questionId, index) => {
          items.push({
            id: `exam-item-${crypto.randomBytes(6).toString("hex")}`,
            paperId: id,
            questionId,
            score: scorePerQuestion,
            orderIndex: index + 1
          });
        });
        targetStudents.forEach((studentId) => {
          assignments.push({
            id: `exam-assign-${crypto.randomBytes(6).toString("hex")}`,
            paperId: id,
            studentId,
            status: "pending",
            assignedAt: now
          });
        });
      }
    );
    return paper;
  }

  const row = await queryOne<DbExamPaper>(
    `INSERT INTO exam_papers (
       id,
       class_id,
       title,
       description,
       publish_mode,
       anti_cheat_level,
       start_at,
       end_at,
       duration_minutes,
       status,
       created_by,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', $10, $11, $12)
     RETURNING *`,
    [
      id,
      input.classId,
      input.title,
      input.description ?? null,
      publishMode,
      antiCheatLevel,
      input.startAt ?? null,
      input.endAt,
      input.durationMinutes ?? null,
      input.createdBy ?? null,
      now,
      now
    ]
  );

  for (let index = 0; index < uniqueQuestionIds.length; index += 1) {
    const questionId = uniqueQuestionIds[index];
    await query(
      `INSERT INTO exam_paper_items (id, paper_id, question_id, score, order_index)
       VALUES ($1, $2, $3, $4, $5)`,
      [`exam-item-${crypto.randomBytes(6).toString("hex")}`, id, questionId, scorePerQuestion, index + 1]
    );
  }

  const students = await getClassStudentIds(input.classId);
  // Guard against stale/invalid student ids by intersecting with class membership.
  const targetStudents =
    publishMode === "targeted" ? assignedStudentIds.filter((id) => students.includes(id)) : students;
  for (const studentId of targetStudents) {
    await query(
      `INSERT INTO exam_assignments (id, paper_id, student_id, status, assigned_at)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (paper_id, student_id) DO NOTHING`,
      [`exam-assign-${crypto.randomBytes(6).toString("hex")}`, id, studentId, now]
    );
  }

  return row ? mapExamPaper(row) : paper;
}

export async function updateExamPaperStatus(input: {
  paperId: string;
  status: ExamPaperStatus;
}): Promise<ExamPaper | null> {
  const now = new Date().toISOString();

  if (!isDbEnabled()) {
    return updateJson<ExamPaper[]>(EXAM_PAPER_FILE, [], (papers) => {
      const normalized = papers.map(normalizeExamPaper);
      const index = normalized.findIndex((item) => item.id === input.paperId);
      if (index === -1) {
        return normalized;
      }
      normalized[index] = {
        ...normalized[index],
        status: input.status,
        updatedAt: now
      };
      return normalized;
    }).then((papers) => papers.find((item) => item.id === input.paperId) ?? null);
  }

  const row = await queryOne<DbExamPaper>(
    `UPDATE exam_papers
     SET status = $2,
         updated_at = $3
     WHERE id = $1
     RETURNING *`,
    [input.paperId, input.status, now]
  );
  return row ? mapExamPaper(row) : null;
}

export async function markExamAssignmentInProgress(input: {
  paperId: string;
  studentId: string;
}): Promise<ExamAssignment> {
  const now = new Date().toISOString();
  const existing = await ensureExamAssignment(input.paperId, input.studentId);
  if (existing.status === "submitted") {
    // Submitted is terminal: autosave/enter exam must not reopen finished attempts.
    return existing;
  }

  if (canUseApiTestExamExecutionFallback()) {
    const fallback: ExamAssignment = {
      id: `exam-assign-${crypto.randomBytes(6).toString("hex")}`,
      paperId: input.paperId,
      studentId: input.studentId,
      status: "in_progress",
      assignedAt: now,
      startedAt: now,
      autoSavedAt: now
    };
    return updateJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, [], (list) => {
      const index = list.findIndex(
        (item) => item.paperId === input.paperId && item.studentId === input.studentId
      );
      if (index >= 0) {
        list[index] = {
          ...list[index],
          status: "in_progress",
          startedAt: list[index].startedAt ?? now,
          autoSavedAt: now
        };
        return list;
      }
      list.push(fallback);
      return list;
    }).then(
      (list) => list.find((item) => item.paperId === input.paperId && item.studentId === input.studentId) ?? fallback
    );
  }

  requireExamAssignmentsDatabase();
  const row = await queryOne<DbExamAssignment>(
    `UPDATE exam_assignments
     SET status = 'in_progress',
         started_at = COALESCE(started_at, $3),
         auto_saved_at = $3
     WHERE paper_id = $1 AND student_id = $2
     RETURNING *`,
    [input.paperId, input.studentId, now]
  );
  return row ? mapExamAssignment(row) : existing;
}

export async function markExamAssignmentSubmitted(input: {
  paperId: string;
  studentId: string;
  score: number;
  total: number;
}): Promise<ExamAssignment> {
  const now = new Date().toISOString();
  const existing = await ensureExamAssignment(input.paperId, input.studentId);
  // Submission write also stamps final scoring snapshot onto assignment for teacher dashboards.

  if (canUseApiTestExamExecutionFallback()) {
    const fallback: ExamAssignment = {
      id: `exam-assign-${crypto.randomBytes(6).toString("hex")}`,
      paperId: input.paperId,
      studentId: input.studentId,
      status: "submitted",
      assignedAt: now,
      startedAt: now,
      autoSavedAt: now,
      submittedAt: now,
      score: input.score,
      total: input.total
    };
    return updateJson<ExamAssignment[]>(EXAM_ASSIGNMENT_FILE, [], (list) => {
      const index = list.findIndex(
        (item) => item.paperId === input.paperId && item.studentId === input.studentId
      );
      if (index >= 0) {
        list[index] = {
          ...list[index],
          status: "submitted",
          startedAt: list[index].startedAt ?? now,
          autoSavedAt: now,
          submittedAt: now,
          score: input.score,
          total: input.total
        };
        return list;
      }
      list.push(fallback);
      return list;
    }).then(
      (list) => list.find((item) => item.paperId === input.paperId && item.studentId === input.studentId) ?? fallback
    );
  }

  requireExamAssignmentsDatabase();
  const row = await queryOne<DbExamAssignment>(
    `UPDATE exam_assignments
     SET status = 'submitted',
         started_at = COALESCE(started_at, $3),
         auto_saved_at = $3,
         submitted_at = $3,
         score = $4,
         total = $5
     WHERE paper_id = $1 AND student_id = $2
     RETURNING *`,
    [input.paperId, input.studentId, now, input.score, input.total]
  );
  return row
    ? mapExamAssignment(row)
    : {
        ...existing,
        status: "submitted",
        startedAt: existing.startedAt ?? now,
        autoSavedAt: now,
        submittedAt: now,
        score: input.score,
        total: input.total
      };
}

export async function upsertExamSubmission(input: {
  paperId: string;
  studentId: string;
  answers: Record<string, string>;
  score: number;
  total: number;
}): Promise<ExamSubmission> {
  const submittedAt = new Date().toISOString();
  // Idempotent upsert allows repeated submit requests without creating duplicate attempts.

  if (canUseApiTestExamExecutionFallback()) {
    const next: ExamSubmission = {
      id: `exam-sub-${crypto.randomBytes(6).toString("hex")}`,
      paperId: input.paperId,
      studentId: input.studentId,
      answers: input.answers,
      score: input.score,
      total: input.total,
      submittedAt
    };
    return updateJson<ExamSubmission[]>(EXAM_SUBMISSION_FILE, [], (list) => {
      const index = list.findIndex((item) => item.paperId === input.paperId && item.studentId === input.studentId);
      if (index >= 0) {
        next.id = list[index].id;
        list[index] = next;
      } else {
        list.push(next);
      }
      return list;
    }).then(
      (list) => list.find((item) => item.paperId === input.paperId && item.studentId === input.studentId) ?? next
    );
  }

  requireExamSubmissionsDatabase();
  const id = `exam-sub-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbExamSubmission>(
    `INSERT INTO exam_submissions (id, paper_id, student_id, answers, score, total, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (paper_id, student_id) DO UPDATE SET
       answers = EXCLUDED.answers,
       score = EXCLUDED.score,
       total = EXCLUDED.total,
       submitted_at = EXCLUDED.submitted_at
     RETURNING *`,
    [id, input.paperId, input.studentId, input.answers, input.score, input.total, submittedAt]
  );
  return row
    ? mapExamSubmission(row)
    : {
        id,
        paperId: input.paperId,
        studentId: input.studentId,
        answers: input.answers,
        score: input.score,
        total: input.total,
        submittedAt
      };
}
