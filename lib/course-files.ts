import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import { getBase64Object, putBase64Object, shouldKeepInlineContent, shouldUseObjectStorage } from "./object-storage";

export type CourseFile = {
  id: string;
  classId: string;
  folder?: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  createdAt: string;
  uploadedBy?: string;
};

const FILE = "course-files.json";

type DbCourseFile = {
  id: string;
  class_id: string;
  folder: string | null;
  title: string;
  resource_type: string;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
  content_base64: string | null;
  content_storage_provider: string | null;
  content_storage_key: string | null;
  link_url: string | null;
  created_at: string;
  uploaded_by: string | null;
};

type CourseFileRecord = CourseFile & {
  contentStorageProvider?: string;
  contentStorageKey?: string;
};

function mapCourseFile(row: DbCourseFile): CourseFileRecord {
  return {
    id: row.id,
    classId: row.class_id,
    folder: row.folder ?? undefined,
    title: row.title,
    resourceType: row.resource_type === "link" ? "link" : "file",
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    size: row.size ?? undefined,
    contentBase64: row.content_base64 ?? undefined,
    contentStorageProvider: row.content_storage_provider ?? undefined,
    contentStorageKey: row.content_storage_key ?? undefined,
    linkUrl: row.link_url ?? undefined,
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by ?? undefined
  };
}

async function hydrateCourseFileContent(file: CourseFileRecord): Promise<CourseFile> {
  if (file.resourceType !== "file") {
    const { contentStorageProvider, contentStorageKey, ...publicFile } = file;
    return publicFile;
  }
  if (file.contentBase64?.trim()) {
    const { contentStorageProvider, contentStorageKey, ...publicFile } = file;
    return publicFile;
  }
  if (!file.contentStorageKey?.trim()) {
    const { contentStorageProvider, contentStorageKey, ...publicFile } = file;
    return publicFile;
  }
  const contentBase64 = await getBase64Object(file.contentStorageKey);
  const { contentStorageProvider, contentStorageKey, ...publicFile } = file;
  return {
    ...publicFile,
    contentBase64: contentBase64 ?? undefined
  };
}

export async function getCourseFiles(): Promise<CourseFile[]> {
  if (!isDbEnabled()) {
    const list = readJson<CourseFileRecord[]>(FILE, []);
    return Promise.all(list.map((item) => hydrateCourseFileContent(item)));
  }
  const rows = await query<DbCourseFile>("SELECT * FROM course_files");
  return Promise.all(rows.map((row) => hydrateCourseFileContent(mapCourseFile(row))));
}

export async function getCourseFilesByClassIds(classIds: string[]): Promise<CourseFile[]> {
  if (!classIds.length) return [];
  if (!isDbEnabled()) {
    const list = await getCourseFiles();
    return list.filter((item) => classIds.includes(item.classId));
  }
  const rows = await query<DbCourseFile>(
    "SELECT * FROM course_files WHERE class_id = ANY($1) ORDER BY created_at DESC",
    [classIds]
  );
  return Promise.all(rows.map((row) => hydrateCourseFileContent(mapCourseFile(row))));
}

export async function createCourseFile(input: {
  classId: string;
  folder?: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  uploadedBy?: string;
}): Promise<CourseFile> {
  const createdAt = new Date().toISOString();
  let contentBase64 = input.contentBase64;
  let contentStorageProvider: string | undefined;
  let contentStorageKey: string | undefined;
  if (input.resourceType === "file" && contentBase64?.trim() && shouldUseObjectStorage("FILE_OBJECT_STORAGE_ENABLED", true)) {
    const stored = await putBase64Object({
      namespace: "course-files",
      base64: contentBase64,
      keyHint: input.fileName ?? input.title
    });
    contentStorageProvider = stored.provider;
    contentStorageKey = stored.key;
    if (!shouldKeepInlineContent("FILE_INLINE_CONTENT", false)) {
      // Default path stores payload in object storage and keeps metadata row lean.
      contentBase64 = undefined;
    }
  }
  const next: CourseFileRecord = {
    ...input,
    id: `file-${crypto.randomBytes(6).toString("hex")}`,
    contentBase64,
    contentStorageProvider,
    contentStorageKey,
    createdAt,
    uploadedBy: input.uploadedBy
  };

  if (!isDbEnabled()) {
    const list = readJson<CourseFileRecord[]>(FILE, []);
    list.push(next);
    writeJson(FILE, list);
    return hydrateCourseFileContent(next);
  }

  const row = await queryOne<DbCourseFile>(
    `INSERT INTO course_files
     (id, class_id, folder, title, resource_type, file_name, mime_type, size, content_base64, content_storage_provider, content_storage_key, link_url, created_at, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      next.id,
      next.classId,
      next.folder ?? null,
      next.title,
      next.resourceType,
      next.fileName ?? null,
      next.mimeType ?? null,
      next.size ?? null,
      next.contentBase64 ?? null,
      next.contentStorageProvider ?? null,
      next.contentStorageKey ?? null,
      next.linkUrl ?? null,
      createdAt,
      next.uploadedBy ?? null
    ]
  );
  return row ? hydrateCourseFileContent(mapCourseFile(row)) : hydrateCourseFileContent(next);
}
