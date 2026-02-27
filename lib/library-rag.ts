import {
  listLearningLibraryItems,
  resolveLearningLibraryFileContentBase64,
  type LearningLibraryItem
} from "./learning-library";
import { readJson, writeJson } from "./storage";

export type LibraryChunk = {
  id: string;
  itemId: string;
  subject: string;
  grade: string;
  contentType: "textbook" | "courseware" | "lesson_plan";
  text: string;
  chunkIndex: number;
  knowledgePointIds: string[];
  sourceUpdatedAt: string;
  indexedAt: string;
};

export type LibraryCitation = {
  chunkId: string;
  itemId: string;
  itemTitle: string;
  subject: string;
  grade: string;
  contentType: "textbook" | "courseware" | "lesson_plan";
  snippet: string;
  score: number;
  knowledgePointIds: string[];
};

const LIBRARY_CHUNKS_FILE = "library-chunks.json";
const CHUNK_LENGTH = 480;
const CHUNK_OVERLAP = 80;

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\r\n\t]/g, " ")
    .replace(/[，。！？、,.!?;:；："'`~\-()（）【】\[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function extractTokens(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [] as string[];
  const words = normalized
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
  const compact = normalized.replace(/\s+/g, "");
  const grams: string[] = [];
  for (let i = 0; i < compact.length - 1 && i < 180; i += 1) {
    grams.push(compact.slice(i, i + 2));
  }
  return uniqueStrings([...words, ...grams]).slice(0, 120);
}

function splitIntoChunks(text: string) {
  const clean = text.trim();
  if (!clean) return [] as string[];
  if (clean.length <= CHUNK_LENGTH) return [clean];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length) {
    const end = Math.min(clean.length, cursor + CHUNK_LENGTH);
    const chunk = clean.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    if (end >= clean.length) break;
    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }
  return chunks;
}

function decodeBase64Text(contentBase64?: string, mimeType?: string) {
  if (!contentBase64) return "";
  const mime = (mimeType ?? "").toLowerCase();
  if (
    mime &&
    !mime.includes("text") &&
    !mime.includes("json") &&
    !mime.includes("xml") &&
    !mime.includes("markdown") &&
    !mime.includes("csv")
  ) {
    return "";
  }
  try {
    return Buffer.from(contentBase64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

async function extractItemText(item: LearningLibraryItem) {
  const parts = [item.title, item.description ?? "", item.textContent ?? ""];
  if (item.sourceType === "file") {
    const contentBase64 = await resolveLearningLibraryFileContentBase64(item);
    parts.push(decodeBase64Text(contentBase64, item.mimeType));
  }
  return parts
    .filter(Boolean)
    .join("\n")
    .replace(/\0/g, "")
    .slice(0, 22000);
}

async function buildChunksForItem(item: LearningLibraryItem, indexedAt: string) {
  const rawText = await extractItemText(item);
  if (!rawText.trim()) return [] as LibraryChunk[];
  const chunks = splitIntoChunks(rawText);
  return chunks.map((text, index) => ({
    id: `lib-chunk-${item.id}-${index + 1}`,
    itemId: item.id,
    subject: item.subject,
    grade: item.grade,
    contentType: item.contentType,
    text,
    chunkIndex: index + 1,
    knowledgePointIds: item.knowledgePointIds ?? [],
    sourceUpdatedAt: item.updatedAt,
    indexedAt
  }));
}

function readChunks() {
  return readJson<LibraryChunk[]>(LIBRARY_CHUNKS_FILE, []);
}

function writeChunks(chunks: LibraryChunk[]) {
  writeJson(LIBRARY_CHUNKS_FILE, chunks);
}

function buildChunkScore(params: {
  queryTokens: string[];
  queryText: string;
  chunk: LibraryChunk;
  item: LearningLibraryItem;
}) {
  const { queryTokens, queryText, chunk, item } = params;
  const chunkText = normalizeSearchText(chunk.text);
  const titleText = normalizeSearchText(item.title);
  if (!chunkText) return 0;

  let score = 0;
  queryTokens.forEach((token) => {
    if (!token) return;
    if (chunkText.includes(token)) {
      score += token.length >= 4 ? 4 : token.length >= 2 ? 2 : 1;
    }
    if (titleText.includes(token)) {
      score += 1.4;
    }
  });

  if (queryText && chunkText.includes(queryText)) {
    score += 6;
  }

  if (item.contentType === "textbook") {
    score += 0.4;
  }

  return Math.round(score * 100) / 100;
}

export async function indexLibraryChunks(input: {
  itemIds?: string[];
  subject?: string;
  grade?: string;
  replace?: boolean;
} = {}) {
  const replace = input.replace !== false;
  const all = await listLearningLibraryItems({
    subject: input.subject,
    grade: input.grade,
    status: "published"
  });
  const targetItemIds = new Set((input.itemIds ?? []).map((item) => item.trim()).filter(Boolean));
  const targetItems = all.filter((item) => (targetItemIds.size ? targetItemIds.has(item.id) : true));
  const indexedAt = new Date().toISOString();
  const chunks = readChunks();
  const targetIdSet = new Set(targetItems.map((item) => item.id));

  let kept = chunks;
  let removedChunks = 0;
  if (replace) {
    kept = chunks.filter((item) => {
      const remove = targetIdSet.has(item.itemId);
      if (remove) removedChunks += 1;
      return !remove;
    });
  }

  const appended = (await Promise.all(targetItems.map((item) => buildChunksForItem(item, indexedAt)))).flat();
  const merged = [...kept, ...appended];
  writeChunks(merged);

  return {
    indexedAt,
    indexedItems: targetItems.length,
    indexedChunks: appended.length,
    removedChunks,
    totalChunks: merged.length
  };
}

async function ensureIndexedForItems(items: LearningLibraryItem[]) {
  const current = readChunks();
  const latestByItem = new Map<string, string>();
  current.forEach((chunk) => {
    const previous = latestByItem.get(chunk.itemId);
    if (!previous || new Date(chunk.sourceUpdatedAt).getTime() > new Date(previous).getTime()) {
      latestByItem.set(chunk.itemId, chunk.sourceUpdatedAt);
    }
  });

  const staleItemIds = items
    .filter((item) => {
      const indexedVersion = latestByItem.get(item.id);
      if (!indexedVersion) return true;
      return new Date(indexedVersion).getTime() < new Date(item.updatedAt).getTime();
    })
    .map((item) => item.id);

  if (staleItemIds.length) {
    await indexLibraryChunks({ itemIds: staleItemIds, replace: true });
  }
}

export async function retrieveLibraryCitations(input: {
  query: string;
  subject?: string;
  grade?: string;
  limit?: number;
  itemIds?: string[];
}) {
  const query = input.query.trim();
  if (!query) return [] as LibraryCitation[];

  const items = await listLearningLibraryItems({
    subject: input.subject,
    grade: input.grade,
    status: "published"
  });
  const itemIdFilter = new Set((input.itemIds ?? []).map((item) => item.trim()).filter(Boolean));
  const targetItems = items.filter((item) => (itemIdFilter.size ? itemIdFilter.has(item.id) : true));
  if (!targetItems.length) return [] as LibraryCitation[];

  await ensureIndexedForItems(targetItems);

  const itemMap = new Map(targetItems.map((item) => [item.id, item]));
  const chunks = readChunks().filter((chunk) => itemMap.has(chunk.itemId));
  const queryTokens = extractTokens(query);
  const queryText = normalizeSearchText(query).replace(/\s+/g, "");

  const scored = chunks
    .map((chunk) => {
      const item = itemMap.get(chunk.itemId);
      if (!item) return null;
      const score = buildChunkScore({ queryTokens, queryText, chunk, item });
      if (score <= 0) return null;
      return {
        chunk,
        item,
        score
      };
    })
    .filter(Boolean) as Array<{ chunk: LibraryChunk; item: LearningLibraryItem; score: number }>;

  const deduped = new Map<string, LibraryCitation>();
  scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.chunk.indexedAt.localeCompare(a.chunk.indexedAt);
    })
    .forEach(({ chunk, item, score }) => {
      if (deduped.has(chunk.itemId)) return;
      deduped.set(chunk.itemId, {
        chunkId: chunk.id,
        itemId: chunk.itemId,
        itemTitle: item.title,
        subject: chunk.subject,
        grade: chunk.grade,
        contentType: chunk.contentType,
        snippet: chunk.text.slice(0, 220),
        score,
        knowledgePointIds: chunk.knowledgePointIds ?? []
      });
    });

  return Array.from(deduped.values()).slice(0, Math.max(1, Math.min(12, input.limit ?? 4)));
}

export function toCitationPrompts(citations: LibraryCitation[]) {
  return citations.map((item, index) => `${index + 1}. 《${item.itemTitle}》：${item.snippet}`);
}
