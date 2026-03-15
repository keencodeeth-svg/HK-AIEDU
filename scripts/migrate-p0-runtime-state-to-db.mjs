import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");

function runtimeFilePath(fileName) {
  return path.join(runtimeDir, fileName);
}

function seedFilePath(fileName) {
  return path.join(seedDir, fileName);
}

function readStateFile(fileName) {
  const runtimePath = runtimeFilePath(fileName);
  const seedPath = seedFilePath(fileName);
  const sourcePath = fs.existsSync(runtimePath) ? runtimePath : fs.existsSync(seedPath) ? seedPath : null;

  if (!sourcePath) {
    return { sourcePath: null, records: [] };
  }

  const raw = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));
  if (!Array.isArray(raw)) {
    throw new Error(`${fileName} must contain a JSON array`);
  }

  return {
    sourcePath,
    records: raw
  };
}

function normalizeString(value, maxLength = 512) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeIso(value, fallback = null) {
  const input = normalizeString(value, 128);
  if (!input) return fallback;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function normalizeInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function normalizeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeString(key, 256);
    if (!normalizedKey) continue;
    const normalizedValue = normalizeString(entry, 2000);
    if (normalizedValue === null) continue;
    next[normalizedKey] = normalizedValue;
  }
  return next;
}

function normalizeStringArray(value, maxLength = 128, maxItems = 50) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeString(item, maxLength)).filter(Boolean))).slice(0, maxItems);
}

function normalizeNullableForeignKey(id, knownIds) {
  const normalized = normalizeString(id, 128);
  if (!normalized) return null;
  return knownIds.has(normalized) ? normalized : null;
}

function summarizeResult(result) {
  return `${result.label}: imported=${result.imported}, skipped=${result.skipped}, source=${result.sourcePath ?? "missing"}`;
}

async function loadIdSet(client, tableName) {
  const rows = await client.query(`SELECT id FROM ${tableName}`);
  return new Set(rows.rows.map((row) => row.id));
}

async function migrateSessions(client, references) {
  const fileName = "sessions.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const userId = normalizeString(record.userId, 128);
    const role = normalizeString(record.role, 32) ?? "student";
    const expiresAt = normalizeIso(record.expiresAt);

    if (!id || !userId || !references.users.has(userId) || !expiresAt) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO sessions (id, user_id, role, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         role = EXCLUDED.role,
         expires_at = EXCLUDED.expires_at`,
      [id, userId, role, expiresAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateAuthLoginAttempts(client) {
  const fileName = "auth-login-attempts.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const key = normalizeString(record.key, 128);
    const email = normalizeString(record.email, 320);
    const ip = normalizeString(record.ip, 128);
    const failedCount = normalizeInteger(record.failedCount, 0);
    const firstFailedAt = normalizeIso(record.firstFailedAt);
    const lockUntil = normalizeIso(record.lockUntil, null);
    const updatedAt = normalizeIso(record.updatedAt, firstFailedAt);

    if (!key || !email || !ip || !firstFailedAt || !updatedAt) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO auth_login_attempts
        (key, email, ip, failed_count, first_failed_at, lock_until, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE SET
         email = EXCLUDED.email,
         ip = EXCLUDED.ip,
         failed_count = EXCLUDED.failed_count,
         first_failed_at = EXCLUDED.first_failed_at,
         lock_until = EXCLUDED.lock_until,
         updated_at = EXCLUDED.updated_at`,
      [key, email.toLowerCase(), ip, Math.max(0, failedCount ?? 0), firstFailedAt, lockUntil, updatedAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateAuthLoginProfiles(client, references) {
  const fileName = "auth-login-profiles.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const userId = normalizeString(record.userId, 128);
    const email = normalizeString(record.email, 320);
    const role = normalizeString(record.role, 32) ?? "student";
    const lastIp = normalizeString(record.lastIp, 128);
    const knownIps = normalizeStringArray(record.knownIps, 128, 20);
    const lastLoginAt = normalizeIso(record.lastLoginAt);
    const updatedAt = normalizeIso(record.updatedAt, lastLoginAt);

    if (!userId || !references.users.has(userId) || !email || !lastIp || !lastLoginAt || !updatedAt) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO auth_login_profiles
        (user_id, email, role, last_ip, known_ips, last_login_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         last_ip = EXCLUDED.last_ip,
         known_ips = EXCLUDED.known_ips,
         last_login_at = EXCLUDED.last_login_at,
         updated_at = EXCLUDED.updated_at`,
      [userId, email.toLowerCase(), role, lastIp, knownIps, lastLoginAt, updatedAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateAuthRecoveryAttempts(client) {
  const fileName = "auth-recovery-attempts.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const role = normalizeString(record.role, 32) ?? "student";
    const email = normalizeString(record.email, 320);
    const issueType = normalizeString(record.issueType, 64) ?? "forgot_password";
    const requesterIp = normalizeString(record.requesterIp, 128);
    const userAgent = normalizeString(record.userAgent, 512);
    const result = normalizeString(record.result, 32) ?? "accepted";
    const limitedBy = normalizeString(record.limitedBy, 16);
    const retryAt = normalizeIso(record.retryAt, null);
    const ticketId = normalizeString(record.ticketId, 128);
    const createdAt = normalizeIso(record.createdAt);

    if (!id || !email || !createdAt) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO auth_recovery_attempts
        (id, role, email, issue_type, requester_ip, user_agent, result, limited_by, retry_at, ticket_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         email = EXCLUDED.email,
         issue_type = EXCLUDED.issue_type,
         requester_ip = EXCLUDED.requester_ip,
         user_agent = EXCLUDED.user_agent,
         result = EXCLUDED.result,
         limited_by = EXCLUDED.limited_by,
         retry_at = EXCLUDED.retry_at,
         ticket_id = EXCLUDED.ticket_id,
         created_at = EXCLUDED.created_at`,
      [id, role, email.toLowerCase(), issueType, requesterIp, userAgent, result, limitedBy, retryAt, ticketId, createdAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateAdminLogs(client, references) {
  const fileName = "admin-logs.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const adminId = normalizeNullableForeignKey(record.adminId, references.users);
    const action = normalizeString(record.action, 128);
    const entityType = normalizeString(record.entityType, 128);
    const entityId = normalizeString(record.entityId, 128);
    const detail = normalizeString(record.detail, 20000);
    const createdAt = normalizeIso(record.createdAt);

    if (!id || !action || !entityType || !createdAt) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, detail, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         admin_id = EXCLUDED.admin_id,
         action = EXCLUDED.action,
         entity_type = EXCLUDED.entity_type,
         entity_id = EXCLUDED.entity_id,
         detail = EXCLUDED.detail,
         created_at = EXCLUDED.created_at`,
      [id, adminId, action, entityType, entityId, detail, createdAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateAssignmentProgress(client, references) {
  const fileName = "assignment-progress.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const assignmentId = normalizeString(record.assignmentId, 128);
    const studentId = normalizeString(record.studentId, 128);
    const status = normalizeString(record.status, 64) ?? "pending";
    const completedAt = normalizeIso(record.completedAt, null);
    const score = normalizeInteger(record.score, null);
    const total = normalizeInteger(record.total, null);

    if (!id || !assignmentId || !studentId || !references.assignments.has(assignmentId) || !references.users.has(studentId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO assignment_progress (id, assignment_id, student_id, status, completed_at, score, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = EXCLUDED.completed_at,
         score = EXCLUDED.score,
         total = EXCLUDED.total`,
      [id, assignmentId, studentId, status, completedAt, score, total]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateAssignmentSubmissions(client, references) {
  const fileName = "assignment-submissions.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const assignmentId = normalizeString(record.assignmentId, 128);
    const studentId = normalizeString(record.studentId, 128);
    const answers = normalizeStringRecord(record.answers);
    const score = normalizeInteger(record.score, 0);
    const total = normalizeInteger(record.total, 0);
    const submittedAt = normalizeIso(record.submittedAt);
    const submissionText = normalizeString(record.submissionText, 20000);

    if (!id || !assignmentId || !studentId || !submittedAt || !references.assignments.has(assignmentId) || !references.users.has(studentId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO assignment_submissions
        (id, assignment_id, student_id, answers, score, total, submitted_at, submission_text)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         score = EXCLUDED.score,
         total = EXCLUDED.total,
         submitted_at = EXCLUDED.submitted_at,
         submission_text = EXCLUDED.submission_text`,
      [id, assignmentId, studentId, JSON.stringify(answers), Math.max(0, score ?? 0), Math.max(0, total ?? 0), submittedAt, submissionText]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateExamAssignments(client, references) {
  const fileName = "exam-assignments.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const paperId = normalizeString(record.paperId, 128);
    const studentId = normalizeString(record.studentId, 128);
    const status = normalizeString(record.status, 64) ?? "pending";
    const assignedAt = normalizeIso(record.assignedAt);
    const startedAt = normalizeIso(record.startedAt, null);
    const autoSavedAt = normalizeIso(record.autoSavedAt, null);
    const submittedAt = normalizeIso(record.submittedAt, null);
    const score = normalizeInteger(record.score, null);
    const total = normalizeInteger(record.total, null);

    if (!id || !paperId || !studentId || !assignedAt || !references.examPapers.has(paperId) || !references.users.has(studentId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO exam_assignments
        (id, paper_id, student_id, status, assigned_at, started_at, auto_saved_at, submitted_at, score, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (paper_id, student_id) DO UPDATE SET
         status = EXCLUDED.status,
         assigned_at = EXCLUDED.assigned_at,
         started_at = EXCLUDED.started_at,
         auto_saved_at = EXCLUDED.auto_saved_at,
         submitted_at = EXCLUDED.submitted_at,
         score = EXCLUDED.score,
         total = EXCLUDED.total`,
      [id, paperId, studentId, status, assignedAt, startedAt, autoSavedAt, submittedAt, score, total]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateExamAnswers(client, references) {
  const fileName = "exam-answers.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const paperId = normalizeString(record.paperId, 128);
    const studentId = normalizeString(record.studentId, 128);
    const answers = normalizeStringRecord(record.answers);
    const updatedAt = normalizeIso(record.updatedAt);

    if (!id || !paperId || !studentId || !updatedAt || !references.examPapers.has(paperId) || !references.users.has(studentId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO exam_answers (id, paper_id, student_id, answers, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (paper_id, student_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         updated_at = EXCLUDED.updated_at`,
      [id, paperId, studentId, JSON.stringify(answers), updatedAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateExamSubmissions(client, references) {
  const fileName = "exam-submissions.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const paperId = normalizeString(record.paperId, 128);
    const studentId = normalizeString(record.studentId, 128);
    const answers = normalizeStringRecord(record.answers);
    const score = normalizeInteger(record.score, 0);
    const total = normalizeInteger(record.total, 0);
    const submittedAt = normalizeIso(record.submittedAt);

    if (!id || !paperId || !studentId || !submittedAt || !references.examPapers.has(paperId) || !references.users.has(studentId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO exam_submissions (id, paper_id, student_id, answers, score, total, submitted_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (paper_id, student_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         score = EXCLUDED.score,
         total = EXCLUDED.total,
         submitted_at = EXCLUDED.submitted_at`,
      [id, paperId, studentId, JSON.stringify(answers), Math.max(0, score ?? 0), Math.max(0, total ?? 0), submittedAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateNotifications(client, references) {
  const fileName = "notifications.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const userId = normalizeString(record.userId, 128);
    const title = normalizeString(record.title, 256);
    const content = normalizeString(record.content, 20000);
    const type = normalizeString(record.type, 64) ?? "info";
    const createdAt = normalizeIso(record.createdAt);
    const readAt = normalizeIso(record.readAt, null);

    if (!id || !userId || !title || !content || !createdAt || !references.users.has(userId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO notifications (id, user_id, title, content, type, created_at, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         type = EXCLUDED.type,
         created_at = EXCLUDED.created_at,
         read_at = EXCLUDED.read_at`,
      [id, userId, title, content, type, createdAt, readAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateParentActionReceipts(client, references) {
  const fileName = "parent-action-receipts.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const parentId = normalizeString(record.parentId, 128);
    const studentId = normalizeString(record.studentId, 128);
    const source = normalizeString(record.source, 64) ?? "weekly_report";
    const actionItemId = normalizeString(record.actionItemId, 128);
    const status = normalizeString(record.status, 32) ?? "done";
    const note = normalizeString(record.note, 2000);
    const estimatedMinutes = normalizeInteger(record.estimatedMinutes, 0);
    const effectScore = normalizeInteger(record.effectScore, 0);
    const completedAt = normalizeIso(record.completedAt);
    const createdAt = normalizeIso(record.createdAt, completedAt);
    const updatedAt = normalizeIso(record.updatedAt, createdAt ?? completedAt);

    if (
      !id ||
      !parentId ||
      !studentId ||
      !actionItemId ||
      !completedAt ||
      !createdAt ||
      !updatedAt ||
      !references.users.has(parentId) ||
      !references.users.has(studentId)
    ) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO parent_action_receipts
        (id, parent_id, student_id, source, action_item_id, status, note, estimated_minutes, effect_score, completed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (parent_id, student_id, source, action_item_id) DO UPDATE SET
         status = EXCLUDED.status,
         note = EXCLUDED.note,
         estimated_minutes = EXCLUDED.estimated_minutes,
         effect_score = EXCLUDED.effect_score,
         completed_at = EXCLUDED.completed_at,
         updated_at = EXCLUDED.updated_at`,
      [
        id,
        parentId,
        studentId,
        source,
        actionItemId,
        status,
        note,
        Math.max(0, Math.min(240, estimatedMinutes ?? 0)),
        Math.max(-100, Math.min(100, effectScore ?? 0)),
        completedAt,
        createdAt,
        updatedAt
      ]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

async function migrateFocusSessions(client, references) {
  const fileName = "focus-sessions.json";
  const { sourcePath, records } = readStateFile(fileName);
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const id = normalizeString(record.id, 128);
    const userId = normalizeString(record.userId, 128);
    const mode = normalizeString(record.mode, 16) === "break" ? "break" : "focus";
    const durationMinutes = normalizeInteger(record.durationMinutes, 0);
    const startedAt = normalizeIso(record.startedAt, null);
    const endedAt = normalizeIso(record.endedAt, null);
    const createdAt = normalizeIso(record.createdAt, endedAt ?? startedAt);

    if (!id || !userId || !createdAt || !references.users.has(userId)) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO focus_sessions
        (id, user_id, mode, duration_minutes, started_at, ended_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         mode = EXCLUDED.mode,
         duration_minutes = EXCLUDED.duration_minutes,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at,
         created_at = EXCLUDED.created_at`,
      [id, userId, mode, Math.max(0, durationMinutes ?? 0), startedAt, endedAt, createdAt]
    );
    imported += 1;
  }

  return { label: fileName, sourcePath, imported, skipped };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

const client = await pool.connect();

try {
  const references = {
    users: await loadIdSet(client, "users"),
    assignments: await loadIdSet(client, "assignments"),
    examPapers: await loadIdSet(client, "exam_papers")
  };

  await client.query("BEGIN");

  const results = [];
  results.push(await migrateSessions(client, references));
  results.push(await migrateAuthLoginAttempts(client));
  results.push(await migrateAuthLoginProfiles(client, references));
  results.push(await migrateAuthRecoveryAttempts(client));
  results.push(await migrateAdminLogs(client, references));
  results.push(await migrateAssignmentProgress(client, references));
  results.push(await migrateAssignmentSubmissions(client, references));
  results.push(await migrateExamAssignments(client, references));
  results.push(await migrateExamAnswers(client, references));
  results.push(await migrateExamSubmissions(client, references));
  results.push(await migrateNotifications(client, references));
  results.push(await migrateParentActionReceipts(client, references));
  results.push(await migrateFocusSessions(client, references));

  await client.query("COMMIT");

  console.log("P0 runtime state migration completed.");
  results.forEach((result) => {
    console.log(`- ${summarizeResult(result)}`);
  });
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Failed to migrate P0 runtime state:", error);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
