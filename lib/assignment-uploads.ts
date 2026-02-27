import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import { deleteObject, getBase64Object, putBase64Object, shouldKeepInlineContent, shouldUseObjectStorage } from "./object-storage";

export type AssignmentUpload = {
  id: string;
  assignmentId: string;
  studentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  contentBase64: string;
  createdAt: string;
};

const FILE = "assignment-uploads.json";

type AssignmentUploadRecord = AssignmentUpload & {
  contentStorageProvider?: string;
  contentStorageKey?: string;
};

type DbUpload = {
  id: string;
  assignment_id: string;
  student_id: string;
  file_name: string;
  mime_type: string;
  size: number;
  content_base64: string | null;
  content_storage_provider: string | null;
  content_storage_key: string | null;
  created_at: string;
};

function mapUpload(row: DbUpload): AssignmentUploadRecord {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    size: row.size,
    contentBase64: row.content_base64 ?? "",
    contentStorageProvider: row.content_storage_provider ?? undefined,
    contentStorageKey: row.content_storage_key ?? undefined,
    createdAt: row.created_at
  };
}

async function hydrateUploadContent(upload: AssignmentUploadRecord): Promise<AssignmentUpload> {
  if (upload.contentBase64?.trim()) {
    const { contentStorageProvider, contentStorageKey, ...publicUpload } = upload;
    return publicUpload;
  }
  if (!upload.contentStorageKey?.trim()) {
    const { contentStorageProvider, contentStorageKey, ...publicUpload } = upload;
    return publicUpload;
  }
  const contentBase64 = await getBase64Object(upload.contentStorageKey);
  const { contentStorageProvider, contentStorageKey, ...publicUpload } = upload;
  return {
    ...publicUpload,
    contentBase64: contentBase64 ?? ""
  };
}

export async function getAssignmentUploads(assignmentId: string, studentId?: string) {
  if (!isDbEnabled()) {
    const list = readJson<AssignmentUploadRecord[]>(FILE, []);
    const filtered = list.filter(
      (item) => item.assignmentId === assignmentId && (!studentId || item.studentId === studentId)
    );
    return Promise.all(filtered.map((item) => hydrateUploadContent(item)));
  }
  if (studentId) {
    const rows = await query<DbUpload>(
      "SELECT * FROM assignment_uploads WHERE assignment_id = $1 AND student_id = $2 ORDER BY created_at DESC",
      [assignmentId, studentId]
    );
    return Promise.all(rows.map((row) => hydrateUploadContent(mapUpload(row))));
  }
  const rows = await query<DbUpload>(
    "SELECT * FROM assignment_uploads WHERE assignment_id = $1 ORDER BY created_at DESC",
    [assignmentId]
  );
  return Promise.all(rows.map((row) => hydrateUploadContent(mapUpload(row))));
}

export async function addAssignmentUpload(input: Omit<AssignmentUpload, "id" | "createdAt">) {
  const createdAt = new Date().toISOString();
  let contentBase64 = input.contentBase64;
  let contentStorageProvider: string | undefined;
  let contentStorageKey: string | undefined;
  if (shouldUseObjectStorage("FILE_OBJECT_STORAGE_ENABLED", true) && contentBase64?.trim()) {
    const stored = await putBase64Object({
      namespace: "assignment-uploads",
      base64: contentBase64,
      keyHint: input.fileName
    });
    contentStorageProvider = stored.provider;
    contentStorageKey = stored.key;
    if (!shouldKeepInlineContent("FILE_INLINE_CONTENT", false)) {
      contentBase64 = "";
    }
  }
  if (!isDbEnabled()) {
    const list = readJson<AssignmentUploadRecord[]>(FILE, []);
    const record: AssignmentUploadRecord = {
      ...input,
      id: `upload-${crypto.randomBytes(6).toString("hex")}`,
      createdAt,
      contentStorageProvider,
      contentStorageKey,
      contentBase64
    };
    list.unshift(record);
    writeJson(FILE, list);
    return hydrateUploadContent(record);
  }
  const id = `upload-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbUpload>(
    `INSERT INTO assignment_uploads
     (id, assignment_id, student_id, file_name, mime_type, size, content_base64, content_storage_provider, content_storage_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      id,
      input.assignmentId,
      input.studentId,
      input.fileName,
      input.mimeType,
      input.size,
      contentBase64,
      contentStorageProvider ?? null,
      contentStorageKey ?? null,
      createdAt
    ]
  );
  return row ? hydrateUploadContent(mapUpload(row)) : null;
}

export async function deleteAssignmentUpload(id: string, studentId?: string) {
  if (!isDbEnabled()) {
    const list = readJson<AssignmentUploadRecord[]>(FILE, []);
    const target = list.find((item) => item.id === id && (!studentId || item.studentId === studentId));
    const next = list.filter((item) => item.id !== id || (studentId && item.studentId !== studentId));
    writeJson(FILE, next);
    await deleteObject(target?.contentStorageKey);
    return next.length !== list.length;
  }
  const rows = await query<{ id: string; content_storage_key: string | null }>(
    studentId
      ? "DELETE FROM assignment_uploads WHERE id = $1 AND student_id = $2 RETURNING id, content_storage_key"
      : "DELETE FROM assignment_uploads WHERE id = $1 RETURNING id, content_storage_key",
    studentId ? [id, studentId] : [id]
  );
  if (rows[0]?.content_storage_key) {
    await deleteObject(rows[0].content_storage_key);
  }
  return rows.length > 0;
}
