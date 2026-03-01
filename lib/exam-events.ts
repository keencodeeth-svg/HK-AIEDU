import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";

export type ExamEventAggregate = {
  id: string;
  paperId: string;
  studentId: string;
  blurCount: number;
  visibilityHiddenCount: number;
  lastEventAt: string;
  updatedAt: string;
};

const EXAM_EVENT_FILE = "exam-events.json";

type DbExamEventAggregate = {
  id: string;
  paper_id: string;
  student_id: string;
  blur_count: number | null;
  visibility_hidden_count: number | null;
  last_event_at: string | null;
  updated_at: string;
};

function mapExamEvent(row: DbExamEventAggregate): ExamEventAggregate {
  return {
    id: row.id,
    paperId: row.paper_id,
    studentId: row.student_id,
    blurCount: Number(row.blur_count ?? 0),
    visibilityHiddenCount: Number(row.visibility_hidden_count ?? 0),
    lastEventAt: row.last_event_at ?? row.updated_at,
    updatedAt: row.updated_at
  };
}

export async function getExamEventByPaperAndStudent(paperId: string, studentId: string): Promise<ExamEventAggregate | null> {
  if (!isDbEnabled()) {
    const list = readJson<ExamEventAggregate[]>(EXAM_EVENT_FILE, []);
    return list.find((item) => item.paperId === paperId && item.studentId === studentId) ?? null;
  }
  const row = await queryOne<DbExamEventAggregate>(
    "SELECT * FROM exam_events WHERE paper_id = $1 AND student_id = $2",
    [paperId, studentId]
  );
  return row ? mapExamEvent(row) : null;
}

export async function getExamEventsByPaper(paperId: string): Promise<ExamEventAggregate[]> {
  if (!isDbEnabled()) {
    const list = readJson<ExamEventAggregate[]>(EXAM_EVENT_FILE, []);
    return list.filter((item) => item.paperId === paperId);
  }
  const rows = await query<DbExamEventAggregate>(
    "SELECT * FROM exam_events WHERE paper_id = $1 ORDER BY updated_at DESC",
    [paperId]
  );
  return rows.map(mapExamEvent);
}

export async function incrementExamEventCounters(input: {
  paperId: string;
  studentId: string;
  blurCountDelta?: number;
  visibilityHiddenCountDelta?: number;
}): Promise<ExamEventAggregate> {
  const blurDelta = Math.max(0, Number(input.blurCountDelta ?? 0));
  const hiddenDelta = Math.max(0, Number(input.visibilityHiddenCountDelta ?? 0));
  const now = new Date().toISOString();

  if (!isDbEnabled()) {
    const list = readJson<ExamEventAggregate[]>(EXAM_EVENT_FILE, []);
    const index = list.findIndex((item) => item.paperId === input.paperId && item.studentId === input.studentId);
    if (index >= 0) {
      const next: ExamEventAggregate = {
        ...list[index],
        blurCount: (list[index].blurCount ?? 0) + blurDelta,
        visibilityHiddenCount: (list[index].visibilityHiddenCount ?? 0) + hiddenDelta,
        lastEventAt: now,
        updatedAt: now
      };
      list[index] = next;
      writeJson(EXAM_EVENT_FILE, list);
      return next;
    }

    const created: ExamEventAggregate = {
      id: `exam-event-${crypto.randomBytes(6).toString("hex")}`,
      paperId: input.paperId,
      studentId: input.studentId,
      blurCount: blurDelta,
      visibilityHiddenCount: hiddenDelta,
      lastEventAt: now,
      updatedAt: now
    };
    list.push(created);
    writeJson(EXAM_EVENT_FILE, list);
    return created;
  }

  const id = `exam-event-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbExamEventAggregate>(
    `INSERT INTO exam_events (
       id,
       paper_id,
       student_id,
       blur_count,
       visibility_hidden_count,
       last_event_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (paper_id, student_id) DO UPDATE SET
       -- Counter increments are additive to preserve event history across tabs/requests.
       blur_count = exam_events.blur_count + EXCLUDED.blur_count,
       visibility_hidden_count = exam_events.visibility_hidden_count + EXCLUDED.visibility_hidden_count,
       last_event_at = EXCLUDED.last_event_at,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, input.paperId, input.studentId, blurDelta, hiddenDelta, now, now]
  );

  return row
    ? mapExamEvent(row)
    : {
        id,
        paperId: input.paperId,
        studentId: input.studentId,
        blurCount: blurDelta,
        visibilityHiddenCount: hiddenDelta,
        lastEventAt: now,
        updatedAt: now
      };
}
