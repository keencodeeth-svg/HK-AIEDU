import crypto from "crypto";
import { extractKnowledgePointCandidates } from "./ai";
import { getKnowledgePoints } from "./content";
import { isDbEnabled, query, queryOne } from "./db";
import { deleteObject, getBase64Object, putBase64Object } from "./object-storage";
import { readJson, writeJson } from "./storage";

export type LibraryContentType = "textbook" | "courseware" | "lesson_plan";
export type LibraryAccessScope = "global" | "class";
export type LibrarySourceType = "file" | "link" | "text";
export type LibraryOwnerRole = "admin" | "teacher";
export type LibraryItemStatus = "published" | "draft";

export type LearningLibraryItem = {
  id: string;
  title: string;
  description?: string;
  contentType: LibraryContentType;
  subject: string;
  grade: string;
  ownerRole: LibraryOwnerRole;
  ownerId: string;
  classId?: string;
  accessScope: LibraryAccessScope;
  sourceType: LibrarySourceType;
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  contentStorageProvider?: string;
  contentStorageKey?: string;
  linkUrl?: string;
  textContent?: string;
  knowledgePointIds: string[];
  extractedKnowledgePoints: string[];
  generatedByAi: boolean;
  status: LibraryItemStatus;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type LearningLibraryAnnotation = {
  id: string;
  itemId: string;
  userId: string;
  quote: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
  note?: string;
  createdAt: string;
};

type DbLibraryItem = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  subject: string;
  grade: string;
  owner_role: string;
  owner_id: string;
  class_id: string | null;
  access_scope: string;
  source_type: string;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
  content_base64: string | null;
  content_storage_provider: string | null;
  content_storage_key: string | null;
  link_url: string | null;
  text_content: string | null;
  knowledge_point_ids: string[] | null;
  extracted_knowledge_points: string[] | null;
  generated_by_ai: boolean | null;
  status: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
};

type DbLibraryAnnotation = {
  id: string;
  item_id: string;
  user_id: string;
  quote: string;
  start_offset: number | null;
  end_offset: number | null;
  color: string | null;
  note: string | null;
  created_at: string;
};

const ITEM_FILE = "learning-library-items.json";
const ANNOTATION_FILE = "learning-library-annotations.json";

function normalizeContentType(value?: string | null): LibraryContentType {
  if (value === "courseware" || value === "lesson_plan" || value === "textbook") {
    return value;
  }
  return "textbook";
}

function normalizeAccessScope(value?: string | null): LibraryAccessScope {
  return value === "class" ? "class" : "global";
}

function normalizeSourceType(value?: string | null): LibrarySourceType {
  if (value === "file" || value === "link" || value === "text") {
    return value;
  }
  return "text";
}

function normalizeOwnerRole(value?: string | null): LibraryOwnerRole {
  return value === "teacher" ? "teacher" : "admin";
}

function normalizeStatus(value?: string | null): LibraryItemStatus {
  return value === "draft" ? "draft" : "published";
}

function uniqueStrings(values?: string[]) {
  return Array.from(new Set((values ?? []).map((item) => item.trim()).filter(Boolean)));
}

function mapDbItem(row: DbLibraryItem): LearningLibraryItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    contentType: normalizeContentType(row.content_type),
    subject: row.subject,
    grade: row.grade,
    ownerRole: normalizeOwnerRole(row.owner_role),
    ownerId: row.owner_id,
    classId: row.class_id ?? undefined,
    accessScope: normalizeAccessScope(row.access_scope),
    sourceType: normalizeSourceType(row.source_type),
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    size: row.size ?? undefined,
    contentBase64: row.content_base64 ?? undefined,
    contentStorageProvider: row.content_storage_provider ?? undefined,
    contentStorageKey: row.content_storage_key ?? undefined,
    linkUrl: row.link_url ?? undefined,
    textContent: row.text_content ?? undefined,
    knowledgePointIds: uniqueStrings(row.knowledge_point_ids ?? []),
    extractedKnowledgePoints: uniqueStrings(row.extracted_knowledge_points ?? []),
    generatedByAi: Boolean(row.generated_by_ai),
    status: normalizeStatus(row.status),
    shareToken: row.share_token ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDbAnnotation(row: DbLibraryAnnotation): LearningLibraryAnnotation {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    quote: row.quote,
    startOffset: row.start_offset ?? undefined,
    endOffset: row.end_offset ?? undefined,
    color: row.color ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at
  };
}

function decodeTextFromBase64(contentBase64?: string, mimeType?: string) {
  if (!contentBase64) return "";
  const mime = (mimeType ?? "").toLowerCase();
  if (
    mime &&
    !mime.includes("text") &&
    !mime.includes("json") &&
    !mime.includes("xml") &&
    !mime.includes("markdown")
  ) {
    return "";
  }
  try {
    return Buffer.from(contentBase64, "base64").toString("utf-8").slice(0, 4000);
  } catch {
    return "";
  }
}

function shouldStoreLibraryFileInObjectStorage() {
  if (process.env.LIBRARY_OBJECT_STORAGE_ENABLED === "false") return false;
  if (process.env.LIBRARY_OBJECT_STORAGE_ENABLED === "true") return true;
  return true;
}

function shouldKeepInlineLibraryFileContent() {
  if (process.env.LIBRARY_INLINE_FILE_CONTENT === "true") return true;
  if (process.env.LIBRARY_INLINE_FILE_CONTENT === "false") return false;
  return false;
}

export async function resolveLearningLibraryFileContentBase64(item: {
  sourceType: LibrarySourceType;
  contentBase64?: string;
  contentStorageKey?: string;
}) {
  if (item.sourceType !== "file") return undefined;
  if (item.contentBase64?.trim()) return item.contentBase64;
  if (!item.contentStorageKey?.trim()) return undefined;
  const base64 = await getBase64Object(item.contentStorageKey);
  return base64 ?? undefined;
}

export async function hydrateLearningLibraryItemContent(item: LearningLibraryItem | null) {
  if (!item) return null;
  if (item.sourceType !== "file") return item;
  if (item.contentBase64?.trim()) return item;
  const contentBase64 = await resolveLearningLibraryFileContentBase64(item);
  return {
    ...item,
    contentBase64
  };
}

export async function extractLibraryKnowledgePointIds(input: {
  subject: string;
  grade: string;
  title: string;
  description?: string;
  textContent?: string;
  contentBase64?: string;
  mimeType?: string;
  seedKnowledgePointIds?: string[];
}) {
  const scoped = (await getKnowledgePoints()).filter(
    (item) => item.subject === input.subject && item.grade === input.grade
  );
  const scopedById = new Map(scoped.map((item) => [item.id, item]));
  const seedIds = uniqueStrings(input.seedKnowledgePointIds ?? []).filter((id) => scopedById.has(id));

  const text = [
    input.title,
    input.description ?? "",
    input.textContent ?? "",
    decodeTextFromBase64(input.contentBase64, input.mimeType)
  ]
    .join("\n")
    .slice(0, 5000);

  const ruleMatched = scoped
    .filter((item) => text.includes(item.title))
    .map((item) => item.id)
    .slice(0, 10);

  const ai = await extractKnowledgePointCandidates({
    subject: input.subject,
    grade: input.grade,
    text,
    candidates: scoped.map((item) => item.title)
  });

  const aiMatchedIds = ai.points
    .map((title) =>
      scoped.find((item) => title === item.title || item.title.includes(title) || title.includes(item.title))
    )
    .filter(Boolean)
    .map((item) => (item ? item.id : ""))
    .filter(Boolean);

  const knowledgePointIds = uniqueStrings([...seedIds, ...ruleMatched, ...aiMatchedIds]).slice(0, 12);
  const extractedKnowledgePoints = knowledgePointIds
    .map((id) => scopedById.get(id)?.title ?? "")
    .filter(Boolean);

  return {
    knowledgePointIds,
    extractedKnowledgePoints
  };
}

export async function listLearningLibraryItems(filters: {
  subject?: string;
  grade?: string;
  contentType?: LibraryContentType;
  accessScope?: LibraryAccessScope;
  classId?: string;
  ownerId?: string;
  status?: LibraryItemStatus;
  shareToken?: string;
} = {}) {
  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    return list
      .filter((item) => (filters.subject ? item.subject === filters.subject : true))
      .filter((item) => (filters.grade ? item.grade === filters.grade : true))
      .filter((item) => (filters.contentType ? item.contentType === filters.contentType : true))
      .filter((item) => (filters.accessScope ? item.accessScope === filters.accessScope : true))
      .filter((item) => (filters.classId ? item.classId === filters.classId : true))
      .filter((item) => (filters.ownerId ? item.ownerId === filters.ownerId : true))
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .filter((item) => (filters.shareToken ? item.shareToken === filters.shareToken : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const where: string[] = [];
  const values: any[] = [];
  if (filters.subject) {
    values.push(filters.subject);
    where.push(`subject = $${values.length}`);
  }
  if (filters.grade) {
    values.push(filters.grade);
    where.push(`grade = $${values.length}`);
  }
  if (filters.contentType) {
    values.push(filters.contentType);
    where.push(`content_type = $${values.length}`);
  }
  if (filters.accessScope) {
    values.push(filters.accessScope);
    where.push(`access_scope = $${values.length}`);
  }
  if (filters.classId) {
    values.push(filters.classId);
    where.push(`class_id = $${values.length}`);
  }
  if (filters.ownerId) {
    values.push(filters.ownerId);
    where.push(`owner_id = $${values.length}`);
  }
  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }
  if (filters.shareToken) {
    values.push(filters.shareToken);
    where.push(`share_token = $${values.length}`);
  }

  const sql = `
    SELECT *
    FROM learning_library_items
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC
  `;
  const rows = await query<DbLibraryItem>(sql, values);
  return rows.map(mapDbItem);
}

export async function getLearningLibraryItemById(id: string) {
  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    return list.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbLibraryItem>("SELECT * FROM learning_library_items WHERE id = $1", [id]);
  return row ? mapDbItem(row) : null;
}

export async function getLearningLibraryItemByShareToken(shareToken: string) {
  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    return list.find((item) => item.shareToken === shareToken) ?? null;
  }
  const row = await queryOne<DbLibraryItem>(
    "SELECT * FROM learning_library_items WHERE share_token = $1 AND status = 'published'",
    [shareToken]
  );
  return row ? mapDbItem(row) : null;
}

export async function createLearningLibraryItem(input: {
  title: string;
  description?: string;
  contentType?: string;
  subject: string;
  grade: string;
  ownerRole: LibraryOwnerRole;
  ownerId: string;
  classId?: string;
  accessScope?: LibraryAccessScope;
  sourceType?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
  knowledgePointIds?: string[];
  generatedByAi?: boolean;
  status?: LibraryItemStatus;
  autoExtractKnowledgePoints?: boolean;
}) {
  const now = new Date().toISOString();
  const contentType = normalizeContentType(input.contentType);
  const accessScope = normalizeAccessScope(input.accessScope);
  const sourceType = normalizeSourceType(input.sourceType);
  const status = normalizeStatus(input.status);

  const extracted =
    input.autoExtractKnowledgePoints === false
      ? {
          knowledgePointIds: uniqueStrings(input.knowledgePointIds),
          extractedKnowledgePoints: [] as string[]
        }
      : await extractLibraryKnowledgePointIds({
          subject: input.subject,
          grade: input.grade,
          title: input.title,
          description: input.description,
          textContent: input.textContent,
          contentBase64: input.contentBase64,
          mimeType: input.mimeType,
          seedKnowledgePointIds: input.knowledgePointIds
        });

  let contentBase64 = input.contentBase64;
  let contentStorageProvider: string | undefined;
  let contentStorageKey: string | undefined;

  if (sourceType === "file" && contentBase64?.trim() && shouldStoreLibraryFileInObjectStorage()) {
    const stored = await putBase64Object({
      namespace: "library",
      base64: contentBase64,
      keyHint: input.fileName ?? input.title
    });
    contentStorageProvider = stored.provider;
    contentStorageKey = stored.key;
    if (!shouldKeepInlineLibraryFileContent()) {
      contentBase64 = undefined;
    }
  }

  const next: LearningLibraryItem = {
    id: `lib-${crypto.randomBytes(8).toString("hex")}`,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    contentType,
    subject: input.subject,
    grade: input.grade,
    ownerRole: input.ownerRole,
    ownerId: input.ownerId,
    classId: input.classId,
    accessScope,
    sourceType,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    contentBase64,
    contentStorageProvider,
    contentStorageKey,
    linkUrl: input.linkUrl,
    textContent: input.textContent,
    knowledgePointIds: extracted.knowledgePointIds,
    extractedKnowledgePoints: extracted.extractedKnowledgePoints,
    generatedByAi: Boolean(input.generatedByAi),
    status,
    shareToken: undefined,
    createdAt: now,
    updatedAt: now
  };

  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    list.unshift(next);
    writeJson(ITEM_FILE, list);
    return next;
  }

  const row = await queryOne<DbLibraryItem>(
    `INSERT INTO learning_library_items
      (id, title, description, content_type, subject, grade, owner_role, owner_id, class_id, access_scope, source_type,
       file_name, mime_type, size, content_base64, content_storage_provider, content_storage_key, link_url, text_content, knowledge_point_ids,
       extracted_knowledge_points, generated_by_ai, status, share_token, created_at, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18, $19,
       $20, $21, $22, $23, $24, $25)
     RETURNING *`,
    [
      next.id,
      next.title,
      next.description ?? null,
      next.contentType,
      next.subject,
      next.grade,
      next.ownerRole,
      next.ownerId,
      next.classId ?? null,
      next.accessScope,
      next.sourceType,
      next.fileName ?? null,
      next.mimeType ?? null,
      next.size ?? null,
      next.contentBase64 ?? null,
      next.contentStorageProvider ?? null,
      next.contentStorageKey ?? null,
      next.linkUrl ?? null,
      next.textContent ?? null,
      next.knowledgePointIds,
      next.extractedKnowledgePoints,
      next.generatedByAi,
      next.status,
      null,
      next.createdAt,
      next.updatedAt
    ]
  );
  return row ? mapDbItem(row) : next;
}

export async function updateLearningLibraryKnowledgePoints(input: {
  id: string;
  knowledgePointIds: string[];
  extractedKnowledgePoints?: string[];
}) {
  const nextIds = uniqueStrings(input.knowledgePointIds);
  const nextTitles = uniqueStrings(input.extractedKnowledgePoints);
  const now = new Date().toISOString();

  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    const index = list.findIndex((item) => item.id === input.id);
    if (index < 0) return null;
    const existing = list[index];
    const next: LearningLibraryItem = {
      ...existing,
      knowledgePointIds: nextIds,
      extractedKnowledgePoints: nextTitles.length ? nextTitles : existing.extractedKnowledgePoints,
      updatedAt: now
    };
    list[index] = next;
    writeJson(ITEM_FILE, list);
    return next;
  }

  const row = await queryOne<DbLibraryItem>(
    `UPDATE learning_library_items
     SET knowledge_point_ids = $2,
         extracted_knowledge_points = $3,
         updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [input.id, nextIds, nextTitles, now]
  );
  return row ? mapDbItem(row) : null;
}

export async function issueLearningLibraryShareToken(id: string) {
  const token = crypto.randomBytes(10).toString("hex");
  const now = new Date().toISOString();

  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const next = {
      ...list[index],
      shareToken: token,
      updatedAt: now
    };
    list[index] = next;
    writeJson(ITEM_FILE, list);
    return next;
  }

  const row = await queryOne<DbLibraryItem>(
    `UPDATE learning_library_items
     SET share_token = $2,
         updated_at = $3
     WHERE id = $1
     RETURNING *`,
    [id, token, now]
  );
  return row ? mapDbItem(row) : null;
}

export async function deleteLearningLibraryItem(id: string) {
  if (!isDbEnabled()) {
    const items = readJson<LearningLibraryItem[]>(ITEM_FILE, []);
    const target = items.find((item) => item.id === id);
    const nextItems = items.filter((item) => item.id !== id);
    if (nextItems.length === items.length) return false;
    writeJson(ITEM_FILE, nextItems);
    await deleteObject(target?.contentStorageKey);

    // Keep local annotation store consistent in file mode.
    const annotations = readJson<LearningLibraryAnnotation[]>(ANNOTATION_FILE, []);
    const nextAnnotations = annotations.filter((item) => item.itemId !== id);
    if (nextAnnotations.length !== annotations.length) {
      writeJson(ANNOTATION_FILE, nextAnnotations);
    }
    return true;
  }

  // Defensive cleanup for environments where cascade or annotation table may be missing.
  try {
    await query("DELETE FROM learning_library_annotations WHERE item_id = $1", [id]);
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code !== "42P01") {
      throw error;
    }
  }

  const target = await getLearningLibraryItemById(id);
  const rows = await query<{ id: string }>(
    "DELETE FROM learning_library_items WHERE id = $1 RETURNING id",
    [id]
  );
  if (rows.length > 0) {
    await deleteObject(target?.contentStorageKey);
  }
  return rows.length > 0;
}

export async function listLearningLibraryAnnotations(itemId: string) {
  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryAnnotation[]>(ANNOTATION_FILE, []);
    return list
      .filter((item) => item.itemId === itemId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const rows = await query<DbLibraryAnnotation>(
    "SELECT * FROM learning_library_annotations WHERE item_id = $1 ORDER BY created_at DESC",
    [itemId]
  );
  return rows.map(mapDbAnnotation);
}

export async function addLearningLibraryAnnotation(input: {
  itemId: string;
  userId: string;
  quote: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
  note?: string;
}) {
  const createdAt = new Date().toISOString();
  const next: LearningLibraryAnnotation = {
    id: `anno-${crypto.randomBytes(8).toString("hex")}`,
    itemId: input.itemId,
    userId: input.userId,
    quote: input.quote.trim(),
    startOffset: input.startOffset,
    endOffset: input.endOffset,
    color: input.color,
    note: input.note,
    createdAt
  };

  if (!isDbEnabled()) {
    const list = readJson<LearningLibraryAnnotation[]>(ANNOTATION_FILE, []);
    list.unshift(next);
    writeJson(ANNOTATION_FILE, list);
    return next;
  }

  const row = await queryOne<DbLibraryAnnotation>(
    `INSERT INTO learning_library_annotations
      (id, item_id, user_id, quote, start_offset, end_offset, color, note, created_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      next.id,
      next.itemId,
      next.userId,
      next.quote,
      next.startOffset ?? null,
      next.endOffset ?? null,
      next.color ?? null,
      next.note ?? null,
      next.createdAt
    ]
  );
  return row ? mapDbAnnotation(row) : next;
}
