import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type DiscussionTopic = {
  id: string;
  classId: string;
  authorId?: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DiscussionReply = {
  id: string;
  discussionId: string;
  authorId?: string;
  parentId?: string;
  content: string;
  createdAt: string;
};

const TOPIC_FILE = "discussions.json";
const REPLY_FILE = "discussion-replies.json";

type DbTopic = {
  id: string;
  class_id: string;
  author_id: string | null;
  title: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

type DbReply = {
  id: string;
  discussion_id: string;
  author_id: string | null;
  parent_id: string | null;
  content: string;
  created_at: string;
};

function mapTopic(row: DbTopic): DiscussionTopic {
  return {
    id: row.id,
    classId: row.class_id,
    authorId: row.author_id ?? undefined,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReply(row: DbReply): DiscussionReply {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    authorId: row.author_id ?? undefined,
    parentId: row.parent_id ?? undefined,
    content: row.content,
    createdAt: row.created_at
  };
}

function sortTopics(list: DiscussionTopic[]) {
  return [...list].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export async function getDiscussionTopics(): Promise<DiscussionTopic[]> {
  if (!isDbEnabled()) {
    return sortTopics(readJson<DiscussionTopic[]>(TOPIC_FILE, []));
  }
  const rows = await query<DbTopic>("SELECT * FROM discussions ORDER BY pinned DESC, updated_at DESC, created_at DESC");
  return rows.map(mapTopic);
}

export async function getDiscussionTopicsByClassIds(classIds: string[]): Promise<DiscussionTopic[]> {
  if (!classIds.length) return [];
  if (!isDbEnabled()) {
    const list = await getDiscussionTopics();
    return sortTopics(list.filter((item) => classIds.includes(item.classId)));
  }
  const rows = await query<DbTopic>(
    "SELECT * FROM discussions WHERE class_id = ANY($1) ORDER BY pinned DESC, updated_at DESC, created_at DESC",
    [classIds]
  );
  return rows.map(mapTopic);
}

export async function getDiscussionById(id: string): Promise<DiscussionTopic | null> {
  if (!isDbEnabled()) {
    const list = await getDiscussionTopics();
    return list.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbTopic>("SELECT * FROM discussions WHERE id = $1", [id]);
  return row ? mapTopic(row) : null;
}

export async function getDiscussionReplies(discussionId: string): Promise<DiscussionReply[]> {
  if (!isDbEnabled()) {
    const list = readJson<DiscussionReply[]>(REPLY_FILE, []);
    return list.filter((item) => item.discussionId === discussionId);
  }
  const rows = await query<DbReply>(
    "SELECT * FROM discussion_replies WHERE discussion_id = $1 ORDER BY created_at ASC",
    [discussionId]
  );
  return rows.map(mapReply);
}

export async function createDiscussionTopic(input: {
  classId: string;
  authorId?: string;
  title: string;
  content: string;
  pinned?: boolean;
}): Promise<DiscussionTopic> {
  const createdAt = new Date().toISOString();
  const next: DiscussionTopic = {
    id: `disc-${crypto.randomBytes(6).toString("hex")}`,
    classId: input.classId,
    authorId: input.authorId,
    title: input.title,
    content: input.content,
    pinned: Boolean(input.pinned),
    createdAt,
    updatedAt: createdAt
  };

  if (!isDbEnabled()) {
    const list = readJson<DiscussionTopic[]>(TOPIC_FILE, []);
    list.push(next);
    writeJson(TOPIC_FILE, list);
    return next;
  }

  const row = await queryOne<DbTopic>(
    `INSERT INTO discussions (id, class_id, author_id, title, content, pinned, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [next.id, next.classId, next.authorId ?? null, next.title, next.content, next.pinned, createdAt, createdAt]
  );
  return row ? mapTopic(row) : next;
}

export async function addDiscussionReply(input: {
  discussionId: string;
  authorId?: string;
  content: string;
  parentId?: string;
}): Promise<DiscussionReply> {
  const createdAt = new Date().toISOString();
  const next: DiscussionReply = {
    id: `reply-${crypto.randomBytes(6).toString("hex")}`,
    discussionId: input.discussionId,
    authorId: input.authorId,
    parentId: input.parentId,
    content: input.content,
    createdAt
  };

  if (!isDbEnabled()) {
    const replyList = readJson<DiscussionReply[]>(REPLY_FILE, []);
    replyList.push(next);
    writeJson(REPLY_FILE, replyList);

    const topicList = readJson<DiscussionTopic[]>(TOPIC_FILE, []);
    const nextTopics = topicList.map((topic) => (topic.id === input.discussionId ? { ...topic, updatedAt: createdAt } : topic));
    writeJson(TOPIC_FILE, nextTopics);
    return next;
  }

  const row = await queryOne<DbReply>(
    `INSERT INTO discussion_replies (id, discussion_id, author_id, parent_id, content, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [next.id, next.discussionId, next.authorId ?? null, next.parentId ?? null, next.content, createdAt]
  );
  await query("UPDATE discussions SET updated_at = $2 WHERE id = $1", [next.discussionId, createdAt]);
  return row ? mapReply(row) : next;
}
