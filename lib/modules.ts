import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import { deleteObject, getBase64Object, putBase64Object, shouldKeepInlineContent, shouldUseObjectStorage } from "./object-storage";

export type CourseModule = {
  id: string;
  classId: string;
  parentId?: string;
  title: string;
  description?: string;
  orderIndex: number;
  createdAt: string;
};

export type ModuleResource = {
  id: string;
  moduleId: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  createdAt: string;
};

const MODULE_FILE = "course-modules.json";
const RESOURCE_FILE = "module-resources.json";

type DbModule = {
  id: string;
  class_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
};

type DbResource = {
  id: string;
  module_id: string;
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
};

type ModuleResourceRecord = ModuleResource & {
  contentStorageProvider?: string;
  contentStorageKey?: string;
};

function mapModule(row: DbModule): CourseModule {
  return {
    id: row.id,
    classId: row.class_id,
    parentId: row.parent_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    orderIndex: row.order_index ?? 0,
    createdAt: row.created_at
  };
}

function mapResource(row: DbResource): ModuleResourceRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    resourceType: (row.resource_type as ModuleResource["resourceType"]) ?? "file",
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    size: row.size ?? undefined,
    contentBase64: row.content_base64 ?? undefined,
    contentStorageProvider: row.content_storage_provider ?? undefined,
    contentStorageKey: row.content_storage_key ?? undefined,
    linkUrl: row.link_url ?? undefined,
    createdAt: row.created_at
  };
}

async function hydrateModuleResourceContent(resource: ModuleResourceRecord): Promise<ModuleResource> {
  if (resource.resourceType !== "file") {
    const { contentStorageProvider, contentStorageKey, ...publicResource } = resource;
    return publicResource;
  }
  if (resource.contentBase64?.trim()) {
    const { contentStorageProvider, contentStorageKey, ...publicResource } = resource;
    return publicResource;
  }
  if (!resource.contentStorageKey?.trim()) {
    const { contentStorageProvider, contentStorageKey, ...publicResource } = resource;
    return publicResource;
  }
  const contentBase64 = await getBase64Object(resource.contentStorageKey);
  const { contentStorageProvider, contentStorageKey, ...publicResource } = resource;
  return {
    ...publicResource,
    contentBase64: contentBase64 ?? undefined
  };
}

export async function getModulesByClass(classId: string): Promise<CourseModule[]> {
  if (!isDbEnabled()) {
    const list = readJson<CourseModule[]>(MODULE_FILE, []);
    return list.filter((item) => item.classId === classId).sort((a, b) => a.orderIndex - b.orderIndex);
  }
  const rows = await query<DbModule>(
    "SELECT * FROM course_modules WHERE class_id = $1 ORDER BY order_index ASC, created_at ASC",
    [classId]
  );
  return rows.map(mapModule);
}

export async function getModuleById(id: string): Promise<CourseModule | null> {
  if (!isDbEnabled()) {
    const list = readJson<CourseModule[]>(MODULE_FILE, []);
    return list.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbModule>("SELECT * FROM course_modules WHERE id = $1", [id]);
  return row ? mapModule(row) : null;
}

export async function createModule(input: {
  classId: string;
  title: string;
  description?: string;
  parentId?: string;
  orderIndex?: number;
}): Promise<CourseModule> {
  const createdAt = new Date().toISOString();
  const next: CourseModule = {
    id: `mod-${crypto.randomBytes(6).toString("hex")}`,
    classId: input.classId,
    parentId: input.parentId,
    title: input.title,
    description: input.description,
    orderIndex: input.orderIndex ?? 0,
    createdAt
  };
  if (!isDbEnabled()) {
    const list = readJson<CourseModule[]>(MODULE_FILE, []);
    list.push(next);
    writeJson(MODULE_FILE, list);
    return next;
  }
  const row = await queryOne<DbModule>(
    `INSERT INTO course_modules (id, class_id, parent_id, title, description, order_index, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      next.id,
      next.classId,
      next.parentId ?? null,
      next.title,
      next.description ?? null,
      next.orderIndex,
      createdAt
    ]
  );
  return row ? mapModule(row) : next;
}

export async function updateModule(input: {
  id: string;
  title?: string;
  description?: string;
  parentId?: string | null;
  orderIndex?: number;
}) {
  if (!isDbEnabled()) {
    const list = readJson<CourseModule[]>(MODULE_FILE, []);
    const index = list.findIndex((item) => item.id === input.id);
    if (index === -1) return null;
    const next = {
      ...list[index],
      title: input.title ?? list[index].title,
      description: input.description ?? list[index].description,
      parentId: input.parentId === undefined ? list[index].parentId : input.parentId ?? undefined,
      orderIndex: input.orderIndex ?? list[index].orderIndex
    };
    list[index] = next;
    writeJson(MODULE_FILE, list);
    return next;
  }

  const row = await queryOne<DbModule>(
    `UPDATE course_modules
     SET title = COALESCE($2, title),
         description = COALESCE($3, description),
         parent_id = COALESCE($4, parent_id),
         order_index = COALESCE($5, order_index)
     WHERE id = $1
     RETURNING *`,
    [input.id, input.title ?? null, input.description ?? null, input.parentId ?? null, input.orderIndex ?? null]
  );
  return row ? mapModule(row) : null;
}

export async function getModuleResources(moduleId: string): Promise<ModuleResource[]> {
  if (!isDbEnabled()) {
    const list = readJson<ModuleResourceRecord[]>(RESOURCE_FILE, []);
    const filtered = list.filter((item) => item.moduleId === moduleId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return Promise.all(filtered.map((item) => hydrateModuleResourceContent(item)));
  }
  const rows = await query<DbResource>(
    "SELECT * FROM module_resources WHERE module_id = $1 ORDER BY created_at DESC",
    [moduleId]
  );
  return Promise.all(rows.map((row) => hydrateModuleResourceContent(mapResource(row))));
}

export async function addModuleResource(input: {
  moduleId: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
}): Promise<ModuleResource> {
  const createdAt = new Date().toISOString();
  let contentBase64 = input.contentBase64;
  let contentStorageProvider: string | undefined;
  let contentStorageKey: string | undefined;
  if (input.resourceType === "file" && contentBase64?.trim() && shouldUseObjectStorage("FILE_OBJECT_STORAGE_ENABLED", true)) {
    const stored = await putBase64Object({
      namespace: "module-resources",
      base64: contentBase64,
      keyHint: input.fileName ?? input.title
    });
    contentStorageProvider = stored.provider;
    contentStorageKey = stored.key;
    if (!shouldKeepInlineContent("FILE_INLINE_CONTENT", false)) {
      contentBase64 = undefined;
    }
  }
  const next: ModuleResourceRecord = {
    ...input,
    id: `res-${crypto.randomBytes(6).toString("hex")}`,
    contentBase64,
    contentStorageProvider,
    contentStorageKey,
    createdAt
  };

  if (!isDbEnabled()) {
    const list = readJson<ModuleResourceRecord[]>(RESOURCE_FILE, []);
    list.push(next);
    writeJson(RESOURCE_FILE, list);
    return hydrateModuleResourceContent(next);
  }

  const row = await queryOne<DbResource>(
    `INSERT INTO module_resources (id, module_id, title, resource_type, file_name, mime_type, size, content_base64, content_storage_provider, content_storage_key, link_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      next.id,
      next.moduleId,
      next.title,
      next.resourceType,
      next.fileName ?? null,
      next.mimeType ?? null,
      next.size ?? null,
      next.contentBase64 ?? null,
      next.contentStorageProvider ?? null,
      next.contentStorageKey ?? null,
      next.linkUrl ?? null,
      createdAt
    ]
  );

  return row ? hydrateModuleResourceContent(mapResource(row)) : hydrateModuleResourceContent(next);
}

export async function deleteModuleResource(id: string) {
  if (!isDbEnabled()) {
    const list = readJson<ModuleResourceRecord[]>(RESOURCE_FILE, []);
    const target = list.find((item) => item.id === id);
    const filtered = list.filter((item) => item.id !== id);
    writeJson(RESOURCE_FILE, filtered);
    await deleteObject(target?.contentStorageKey);
    return true;
  }
  const rows = await query<{ id: string; content_storage_key: string | null }>(
    "DELETE FROM module_resources WHERE id = $1 RETURNING id, content_storage_key",
    [id]
  );
  if (rows[0]?.content_storage_key) {
    await deleteObject(rows[0].content_storage_key);
  }
  return true;
}
