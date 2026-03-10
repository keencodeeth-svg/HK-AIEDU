import crypto from "crypto";
import { readJson, updateJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type Notification = {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  readAt?: string;
};

const NOTIFY_FILE = "notifications.json";

type DbNotification = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  read_at: string | null;
};

type NotificationInput = {
  userId: string;
  title: string;
  content: string;
  type: string;
};

function mapNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    type: row.type,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined
  };
}

export async function getNotificationsByUser(userId: string): Promise<Notification[]> {
  if (!isDbEnabled()) {
    const list = readJson<Notification[]>(NOTIFY_FILE, []);
    return list.filter((item) => item.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const rows = await query<DbNotification>(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(mapNotification);
}

export async function createNotificationsBulk(input: NotificationInput[]): Promise<Notification[]> {
  if (!input.length) {
    return [];
  }

  const createdAt = new Date().toISOString();
  if (!isDbEnabled()) {
    const next = input.map<Notification>((item) => ({
      id: `notice-${crypto.randomBytes(6).toString("hex")}`,
      userId: item.userId,
      title: item.title,
      content: item.content,
      type: item.type,
      createdAt
    }));
    await updateJson<Notification[]>(NOTIFY_FILE, [], (list) => {
      list.push(...next);
    });
    return next;
  }

  const ids: string[] = [];
  const params: Array<string | null> = [];
  const values = input.map((item, index) => {
    const id = `notice-${crypto.randomBytes(6).toString("hex")}`;
    ids.push(id);
    const offset = index * 6;
    params.push(id, item.userId, item.title, item.content, item.type, createdAt);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
  });

  const rows = await query<DbNotification>(
    `INSERT INTO notifications (id, user_id, title, content, type, created_at)
     VALUES ${values.join(", ")}
     RETURNING *`,
    params
  );
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id, index) => {
    const matched = rowMap.get(id);
    return matched
      ? mapNotification(matched)
      : {
          id,
          userId: input[index].userId,
          title: input[index].title,
          content: input[index].content,
          type: input[index].type,
          createdAt
        };
  });
}

export async function createNotification(input: NotificationInput): Promise<Notification> {
  const created = await createNotificationsBulk([input]);
  return created[0];
}

export async function markNotificationRead(id: string): Promise<Notification | null> {
  const readAt = new Date().toISOString();
  if (!isDbEnabled()) {
    return updateJson<Notification[]>(NOTIFY_FILE, [], (list) => {
      const index = list.findIndex((item) => item.id === id);
      if (index === -1) return list;
      const next = { ...list[index], readAt };
      list[index] = next;
      return list;
    }).then((list) => list.find((item) => item.id === id) ?? null);
  }
  const row = await queryOne<DbNotification>(
    "UPDATE notifications SET read_at = $2 WHERE id = $1 RETURNING *",
    [id, readAt]
  );
  return row ? mapNotification(row) : null;
}
