import crypto from "crypto";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";
import { getQuestions } from "./content";
import { readJson, writeJson } from "./storage";

export type CorrectionTaskStatus = "pending" | "completed";

export type CorrectionTask = {
  id: string;
  userId: string;
  questionId: string;
  subject: string;
  knowledgePointId: string;
  status: CorrectionTaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt?: string | null;
};

type DbTask = {
  id: string;
  user_id: string;
  question_id: string;
  subject: string;
  knowledge_point_id: string;
  status: CorrectionTaskStatus;
  due_date: string;
  created_at: string;
  completed_at: string | null;
};

function mapTask(row: DbTask): CorrectionTask {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    subject: row.subject,
    knowledgePointId: row.knowledge_point_id,
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function requireCorrectionsDatabase() {
  requireDatabaseEnabled("correction_tasks");
}

function canUseApiTestCorrectionsFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

export async function getCorrectionTasksByUser(userId: string): Promise<CorrectionTask[]> {
  if (canUseApiTestCorrectionsFallback()) {
    const list = readJson<CorrectionTask[]>("correction-tasks.json", []);
    return list
      .filter((item) => item.userId === userId)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }
  requireCorrectionsDatabase();
  const rows = await query<DbTask>(
    "SELECT * FROM correction_tasks WHERE user_id = $1 ORDER BY due_date ASC, created_at DESC",
    [userId]
  );
  return rows.map(mapTask);
}

export async function addCorrectionTasks(params: {
  userId: string;
  questionIds: string[];
  dueDate: string;
}) {
  const { userId, questionIds, dueDate } = params;
  const questions = await getQuestions();
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const existing = await getCorrectionTasksByUser(userId);
  const existingPending = new Set(existing.filter((t) => t.status === "pending").map((t) => t.questionId));

  const created: CorrectionTask[] = [];
  const skipped: { questionId: string; reason: string }[] = [];

  for (const questionId of questionIds) {
    const question = questionMap.get(questionId);
    if (!question) {
      skipped.push({ questionId, reason: "题目不存在" });
      continue;
    }
    if (existingPending.has(questionId)) {
      skipped.push({ questionId, reason: "已有未完成订正任务" });
      continue;
    }

    const task: CorrectionTask = {
      id: `task-${crypto.randomBytes(6).toString("hex")}`,
      userId,
      questionId,
      subject: question.subject,
      knowledgePointId: question.knowledgePointId,
      status: "pending",
      dueDate,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    if (canUseApiTestCorrectionsFallback()) {
      const list = readJson<CorrectionTask[]>("correction-tasks.json", []);
      list.push(task);
      writeJson("correction-tasks.json", list);
      created.push(task);
      continue;
    }

    const row = await queryOne<DbTask>(
      `INSERT INTO correction_tasks (id, user_id, question_id, subject, knowledge_point_id, status, due_date, created_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        task.id,
        task.userId,
        task.questionId,
        task.subject,
        task.knowledgePointId,
        task.status,
        task.dueDate,
        task.createdAt,
        task.completedAt ?? null
      ]
    );

    if (row) {
      created.push(mapTask(row));
    }
  }

  return { created, skipped };
}

export async function updateCorrectionTask(params: {
  id: string;
  userId: string;
  status: CorrectionTaskStatus;
}) {
  const { id, userId, status } = params;
  const completedAt = status === "completed" ? new Date().toISOString() : null;

  if (canUseApiTestCorrectionsFallback()) {
    const list = readJson<CorrectionTask[]>("correction-tasks.json", []);
    const index = list.findIndex((item) => item.id === id && item.userId === userId);
    if (index === -1) return null;
    const next = { ...list[index], status, completedAt } as CorrectionTask;
    list[index] = next;
    writeJson("correction-tasks.json", list);
    return next;
  }

  requireCorrectionsDatabase();

  const row = await queryOne<DbTask>(
    `UPDATE correction_tasks
     SET status = $3,
         completed_at = $4
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, status, completedAt]
  );
  return row ? mapTask(row) : null;
}
