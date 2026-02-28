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
  confidence: number;
  trustLevel: "high" | "medium" | "low";
  riskLevel: "low" | "medium" | "high";
  matchRatio: number;
  reason: string[];
  knowledgePointIds: string[];
};

export type CitationGovernanceSummary = {
  total: number;
  averageConfidence: number;
  highTrustCount: number;
  mediumTrustCount: number;
  lowTrustCount: number;
  riskLevel: "low" | "medium" | "high";
  needsManualReview: boolean;
  manualReviewReason: string;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
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
  if (!chunkText) {
    return {
      score: 0,
      matchedTokenCount: 0,
      queryTokenCount: queryTokens.length,
      exactMatch: false
    };
  }

  let score = 0;
  const matchedTokens = new Set<string>();
  queryTokens.forEach((token) => {
    if (!token) return;
    if (chunkText.includes(token)) {
      score += token.length >= 4 ? 4 : token.length >= 2 ? 2 : 1;
      matchedTokens.add(token);
    }
    if (titleText.includes(token)) {
      score += 1.4;
      matchedTokens.add(token);
    }
  });

  const exactMatch = Boolean(queryText && chunkText.includes(queryText));
  if (queryText && chunkText.includes(queryText)) {
    score += 6;
  }

  if (item.contentType === "textbook") {
    score += 0.4;
  }

  return {
    score: Math.round(score * 100) / 100,
    matchedTokenCount: matchedTokens.size,
    queryTokenCount: queryTokens.length,
    exactMatch
  };
}

function resolveCitationTrustLevel(confidence: number): LibraryCitation["trustLevel"] {
  if (confidence >= 78) return "high";
  if (confidence >= 55) return "medium";
  return "low";
}

function resolveCitationRiskLevel(confidence: number): LibraryCitation["riskLevel"] {
  if (confidence >= 78) return "low";
  if (confidence >= 55) return "medium";
  return "high";
}

function calculateCitationConfidence(input: {
  score: number;
  maxScore: number;
  matchedTokenCount: number;
  queryTokenCount: number;
  exactMatch: boolean;
  contentType: LibraryCitation["contentType"];
}) {
  const scorePart = input.maxScore > 0 ? (input.score / input.maxScore) * 62 : 0;
  const coveragePart =
    input.queryTokenCount > 0 ? (input.matchedTokenCount / input.queryTokenCount) * 28 : 0;
  const exactMatchBonus = input.exactMatch ? 8 : 0;
  const sourceBonus = input.contentType === "textbook" ? 4 : 0;
  return clamp(scorePart + coveragePart + exactMatchBonus + sourceBonus, 0, 100);
}

function buildCitationReason(input: {
  confidence: number;
  matchedTokenCount: number;
  queryTokenCount: number;
  exactMatch: boolean;
  contentType: LibraryCitation["contentType"];
}) {
  const reasons: string[] = [];
  if (input.exactMatch) {
    reasons.push("命中完整问题语句");
  }
  if (input.queryTokenCount > 0) {
    reasons.push(`关键词覆盖 ${input.matchedTokenCount}/${input.queryTokenCount}`);
  }
  if (input.contentType === "textbook") {
    reasons.push("来源为教材正文");
  }
  if (input.confidence < 55) {
    reasons.push("匹配置信度偏低，建议人工复核");
  }
  return reasons.slice(0, 4);
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
      const metrics = buildChunkScore({ queryTokens, queryText, chunk, item });
      if (metrics.score <= 0) return null;
      return {
        chunk,
        item,
        score: metrics.score,
        matchedTokenCount: metrics.matchedTokenCount,
        queryTokenCount: metrics.queryTokenCount,
        exactMatch: metrics.exactMatch
      };
    })
    .filter(Boolean) as Array<{
    chunk: LibraryChunk;
    item: LearningLibraryItem;
    score: number;
    matchedTokenCount: number;
    queryTokenCount: number;
    exactMatch: boolean;
  }>;

  const maxScore = scored.reduce((max, item) => Math.max(max, item.score), 0);

  const deduped = new Map<string, LibraryCitation>();
  scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.chunk.indexedAt.localeCompare(a.chunk.indexedAt);
    })
    .forEach(({ chunk, item, score, matchedTokenCount, queryTokenCount, exactMatch }) => {
      if (deduped.has(chunk.itemId)) return;
      const confidence = calculateCitationConfidence({
        score,
        maxScore,
        matchedTokenCount,
        queryTokenCount,
        exactMatch,
        contentType: chunk.contentType
      });
      const trustLevel = resolveCitationTrustLevel(confidence);
      const riskLevel = resolveCitationRiskLevel(confidence);
      const matchRatio = queryTokenCount > 0 ? clamp((matchedTokenCount / queryTokenCount) * 100, 0, 100) / 100 : 0;
      const reason = buildCitationReason({
        confidence,
        matchedTokenCount,
        queryTokenCount,
        exactMatch,
        contentType: chunk.contentType
      });
      deduped.set(chunk.itemId, {
        chunkId: chunk.id,
        itemId: chunk.itemId,
        itemTitle: item.title,
        subject: chunk.subject,
        grade: chunk.grade,
        contentType: chunk.contentType,
        snippet: chunk.text.slice(0, 220),
        score,
        confidence,
        trustLevel,
        riskLevel,
        matchRatio,
        reason,
        knowledgePointIds: chunk.knowledgePointIds ?? []
      });
    });

  return Array.from(deduped.values()).slice(0, Math.max(1, Math.min(12, input.limit ?? 4)));
}

export function summarizeCitationGovernance(citations: LibraryCitation[]): CitationGovernanceSummary {
  if (!citations.length) {
    return {
      total: 0,
      averageConfidence: 0,
      highTrustCount: 0,
      mediumTrustCount: 0,
      lowTrustCount: 0,
      riskLevel: "high",
      needsManualReview: true,
      manualReviewReason: "未检索到教材依据"
    };
  }

  const highTrustCount = citations.filter((item) => item.trustLevel === "high").length;
  const mediumTrustCount = citations.filter((item) => item.trustLevel === "medium").length;
  const lowTrustCount = citations.filter((item) => item.trustLevel === "low").length;
  const averageConfidence = clamp(
    citations.reduce((sum, item) => sum + item.confidence, 0) / citations.length,
    0,
    100
  );

  const lowRatio = lowTrustCount / citations.length;
  const riskLevel: CitationGovernanceSummary["riskLevel"] =
    lowRatio >= 0.5 || averageConfidence < 55
      ? "high"
      : lowRatio >= 0.25 || averageConfidence < 72
        ? "medium"
        : "low";
  const needsManualReview = riskLevel !== "low";
  const manualReviewReason =
    lowTrustCount > 0
      ? `低可信引用 ${lowTrustCount} 条，平均置信度 ${averageConfidence}`
      : `平均置信度 ${averageConfidence}`;

  return {
    total: citations.length,
    averageConfidence,
    highTrustCount,
    mediumTrustCount,
    lowTrustCount,
    riskLevel,
    needsManualReview,
    manualReviewReason
  };
}

export function toCitationPrompts(citations: LibraryCitation[]) {
  return citations.map((item, index) => `${index + 1}. 《${item.itemTitle}》：${item.snippet}`);
}
