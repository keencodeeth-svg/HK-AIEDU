import crypto from "crypto";
import { mutateJson, readJson, transactJsonFiles } from "./storage";
import { isDbEnabled, query } from "./db";
import { getUsers } from "./auth";

export type InboxThread = {
  id: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
};

export type InboxParticipant = {
  id: string;
  threadId: string;
  userId: string;
  lastReadAt?: string;
};

export type InboxMessage = {
  id: string;
  threadId: string;
  senderId?: string;
  content: string;
  createdAt: string;
};

export type InboxThreadSummary = InboxThread & {
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessage?: InboxMessage | null;
  unreadCount: number;
};

const THREAD_FILE = "inbox-threads.json";
const PARTICIPANT_FILE = "inbox-participants.json";
const MESSAGE_FILE = "inbox-messages.json";

type DbThread = {
  id: string;
  subject: string;
  created_at: string;
  updated_at: string;
  last_read_at?: string | null;
};

type DbParticipant = {
  id: string;
  thread_id: string;
  user_id: string;
  last_read_at: string | null;
};

type DbMessage = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
};

function mapThread(row: DbThread): InboxThread {
  return {
    id: row.id,
    subject: row.subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapParticipant(row: DbParticipant): InboxParticipant {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    lastReadAt: row.last_read_at ?? undefined
  };
}

function mapMessage(row: DbMessage): InboxMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id ?? undefined,
    content: row.content,
    createdAt: row.created_at
  };
}

function calcUnread(messages: InboxMessage[], lastReadAt?: string, userId?: string) {
  if (!messages.length) return 0;
  const last = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter((msg) => {
    if (userId && msg.senderId === userId) return false;
    return new Date(msg.createdAt).getTime() > last;
  }).length;
}

export async function getThreadsForUser(userId: string): Promise<InboxThreadSummary[]> {
  if (!isDbEnabled()) {
    const threads = readJson<InboxThread[]>(THREAD_FILE, []);
    const participants = readJson<InboxParticipant[]>(PARTICIPANT_FILE, []);
    const messages = readJson<InboxMessage[]>(MESSAGE_FILE, []);
    const users = await getUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    const myParticipants = participants.filter((p) => p.userId === userId);
    const threadIds = new Set(myParticipants.map((p) => p.threadId));
    const summaries = threads
      .filter((t) => threadIds.has(t.id))
      .map((thread) => {
        const threadMessages = messages
          .filter((msg) => msg.threadId === thread.id)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        const lastMessage = threadMessages[0] ?? null;
        const myReadAt = myParticipants.find((p) => p.threadId === thread.id)?.lastReadAt;
        const threadParticipants = participants
          .filter((p) => p.threadId === thread.id && p.userId !== userId)
          .map((p) => {
            const user = userMap.get(p.userId);
            return { id: p.userId, name: user?.name ?? "成员", role: user?.role ?? "student" };
          });
        return {
          ...thread,
          participants: threadParticipants,
          lastMessage,
          unreadCount: calcUnread(threadMessages, myReadAt, userId)
        };
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return summaries;
  }

  const threadRows = await query<DbThread & { last_read_at: string | null }>(
    `SELECT t.*, p.last_read_at
     FROM inbox_threads t
     JOIN inbox_participants p ON t.id = p.thread_id
     WHERE p.user_id = $1
     ORDER BY t.updated_at DESC`,
    [userId]
  );
  const threads = threadRows.map(mapThread);
  const readMap = new Map(threadRows.map((row) => [row.id, row.last_read_at ?? undefined]));
  if (!threads.length) return [];

  const threadIds = threads.map((t) => t.id);
  const messageRows = await query<DbMessage>(
    "SELECT * FROM inbox_messages WHERE thread_id = ANY($1) ORDER BY created_at DESC",
    [threadIds]
  );
  const messages = messageRows.map(mapMessage);
  const participantRows = await query<DbParticipant & { name: string; role: string }>(
    `SELECT ip.*, u.name, u.role
     FROM inbox_participants ip
     JOIN users u ON ip.user_id = u.id
     WHERE ip.thread_id = ANY($1)`,
    [threadIds]
  );
  const participants = participantRows.map((row) => ({
    ...mapParticipant(row),
    name: row.name,
    role: row.role
  }));

  return threads.map((thread) => {
    const threadMessages = messages.filter((msg) => msg.threadId === thread.id);
    const lastMessage = threadMessages[0] ?? null;
    const threadParticipants = participants
      .filter((p) => p.threadId === thread.id && p.userId !== userId)
      .map((p) => ({ id: p.userId, name: p.name, role: p.role }));
    const unreadCount = calcUnread(threadMessages, readMap.get(thread.id), userId);
    return {
      ...thread,
      participants: threadParticipants,
      lastMessage,
      unreadCount
    };
  });
}

export async function getThreadMessages(threadId: string, userId?: string) {
  if (!isDbEnabled()) {
    const threads = readJson<InboxThread[]>(THREAD_FILE, []);
    const participants = readJson<InboxParticipant[]>(PARTICIPANT_FILE, []);
    const messages = readJson<InboxMessage[]>(MESSAGE_FILE, []);
    const thread = threads.find((t) => t.id === threadId) ?? null;
    const threadMessages = messages
      .filter((msg) => msg.threadId === threadId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    const users = await getUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    const threadParticipants = participants
      .filter((p) => p.threadId === threadId)
      .map((p) => {
        const user = userMap.get(p.userId);
        return { id: p.userId, name: user?.name ?? "成员", role: user?.role ?? "student" };
      });
    if (userId) {
      await mutateJson<InboxParticipant[], void>(PARTICIPANT_FILE, [], (latestParticipants) => {
        const index = latestParticipants.findIndex((p) => p.threadId === threadId && p.userId === userId);
        if (index >= 0) {
          latestParticipants[index] = { ...latestParticipants[index], lastReadAt: new Date().toISOString() };
        }
        return { result: undefined };
      });
    }
    return { thread, participants: threadParticipants, messages: threadMessages };
  }

  const threadRows = await query<DbThread>("SELECT * FROM inbox_threads WHERE id = $1", [threadId]);
  const thread = threadRows[0] ? mapThread(threadRows[0]) : null;
  if (!thread) return { thread: null, participants: [], messages: [] };

  const messageRows = await query<DbMessage>(
    "SELECT * FROM inbox_messages WHERE thread_id = $1 ORDER BY created_at ASC",
    [threadId]
  );
  const participantRows = await query<DbParticipant & { name: string; role: string }>(
    `SELECT ip.*, u.name, u.role
     FROM inbox_participants ip
     JOIN users u ON ip.user_id = u.id
     WHERE ip.thread_id = $1`,
    [threadId]
  );
  const participants = participantRows.map((row) => ({
    ...mapParticipant(row),
    name: row.name,
    role: row.role
  }));
  if (userId && participants.some((p) => p.userId === userId)) {
    await query(
      "UPDATE inbox_participants SET last_read_at = $1 WHERE thread_id = $2 AND user_id = $3",
      [new Date().toISOString(), threadId, userId]
    );
  }
  return {
    thread,
    participants: participants.map((p) => ({ id: p.userId, name: p.name, role: p.role })),
    messages: messageRows.map(mapMessage)
  };
}

export async function createThread(input: {
  subject: string;
  senderId: string;
  recipientIds: string[];
  content: string;
}): Promise<{ threadId: string }> {
  const now = new Date().toISOString();
  const threadId = `thread-${crypto.randomBytes(6).toString("hex")}`;
  const messageId = `msg-${crypto.randomBytes(6).toString("hex")}`;
  const allParticipants = Array.from(new Set([input.senderId, ...input.recipientIds]));

  if (!isDbEnabled()) {
    await transactJsonFiles<{
      threads: InboxThread[];
      participants: InboxParticipant[];
      messages: InboxMessage[];
    }, void>(
      {
        threads: { fileName: THREAD_FILE, fallback: [] },
        participants: { fileName: PARTICIPANT_FILE, fallback: [] },
        messages: { fileName: MESSAGE_FILE, fallback: [] }
      },
      ({ threads, participants, messages }) => {
        threads.push({ id: threadId, subject: input.subject, createdAt: now, updatedAt: now });
        allParticipants.forEach((userId) => {
          participants.push({
            id: `part-${crypto.randomBytes(6).toString("hex")}`,
            threadId,
            userId,
            lastReadAt: userId === input.senderId ? now : undefined
          });
        });
        messages.push({ id: messageId, threadId, senderId: input.senderId, content: input.content, createdAt: now });
      }
    );
    return { threadId };
  }

  await query(
    `INSERT INTO inbox_threads (id, subject, created_at, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [threadId, input.subject, now, now]
  );
  for (const userId of allParticipants) {
    await query(
      `INSERT INTO inbox_participants (id, thread_id, user_id, last_read_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (thread_id, user_id) DO NOTHING`,
      [
        `part-${crypto.randomBytes(6).toString("hex")}`,
        threadId,
        userId,
        userId === input.senderId ? now : null
      ]
    );
  }
  await query(
    `INSERT INTO inbox_messages (id, thread_id, sender_id, content, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [messageId, threadId, input.senderId, input.content, now]
  );
  return { threadId };
}

export async function addMessage(input: { threadId: string; senderId: string; content: string }) {
  const now = new Date().toISOString();
  const messageId = `msg-${crypto.randomBytes(6).toString("hex")}`;
  if (!isDbEnabled()) {
    await transactJsonFiles<{
      threads: InboxThread[];
      participants: InboxParticipant[];
      messages: InboxMessage[];
    }, void>(
      {
        threads: { fileName: THREAD_FILE, fallback: [] },
        participants: { fileName: PARTICIPANT_FILE, fallback: [] },
        messages: { fileName: MESSAGE_FILE, fallback: [] }
      },
      ({ threads, participants, messages }) => {
        messages.push({
          id: messageId,
          threadId: input.threadId,
          senderId: input.senderId,
          content: input.content,
          createdAt: now
        });
        const threadIndex = threads.findIndex((t) => t.id === input.threadId);
        if (threadIndex >= 0) {
          threads[threadIndex] = { ...threads[threadIndex], updatedAt: now };
        }
        const participantIndex = participants.findIndex(
          (p) => p.threadId === input.threadId && p.userId === input.senderId
        );
        if (participantIndex >= 0) {
          participants[participantIndex] = { ...participants[participantIndex], lastReadAt: now };
        }
      }
    );
    return { id: messageId };
  }

  await query(
    `INSERT INTO inbox_messages (id, thread_id, sender_id, content, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [messageId, input.threadId, input.senderId, input.content, now]
  );
  await query("UPDATE inbox_threads SET updated_at = $1 WHERE id = $2", [now, input.threadId]);
  await query(
    "UPDATE inbox_participants SET last_read_at = $1 WHERE thread_id = $2 AND user_id = $3",
    [now, input.threadId, input.senderId]
  );
  return { id: messageId };
}
