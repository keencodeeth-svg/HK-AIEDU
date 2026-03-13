import crypto from "crypto";
import { mutateJson, readJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type FocusSession = {
  id: string;
  userId: string;
  mode: "focus" | "break";
  durationMinutes: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
};

const FILE = "focus-sessions.json";
const MAX_FILE_RECORDS = 5000;

type DbFocusSession = {
  id: string;
  user_id: string;
  mode: string;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

function mapSession(row: DbFocusSession): FocusSession {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode === "break" ? "break" : "focus",
    durationMinutes: row.duration_minutes,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    createdAt: row.created_at
  };
}

function toDateKey(date: Date) {
  return date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}

export async function getFocusSessionsByUser(userId: string): Promise<FocusSession[]> {
  if (!isDbEnabled()) {
    const list = readJson<FocusSession[]>(FILE, []);
    return list.filter((item) => item.userId === userId);
  }
  const rows = await query<DbFocusSession>(
    "SELECT * FROM focus_sessions WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(mapSession);
}

export async function addFocusSession(input: {
  userId: string;
  mode: "focus" | "break";
  durationMinutes: number;
  startedAt?: string;
  endedAt?: string;
}) {
  const createdAt = input.endedAt ?? new Date().toISOString();
  if (!isDbEnabled()) {
    const record: FocusSession = {
      id: `focus-${crypto.randomBytes(6).toString("hex")}`,
      userId: input.userId,
      mode: input.mode,
      durationMinutes: input.durationMinutes,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? createdAt,
      createdAt
    };
    return mutateJson<FocusSession[], FocusSession>(FILE, [], (list) => {
      const next = [record, ...list].slice(0, MAX_FILE_RECORDS);
      return {
        next,
        result: record
      };
    });
  }

  const id = `focus-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbFocusSession>(
    `INSERT INTO focus_sessions
     (id, user_id, mode, duration_minutes, started_at, ended_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.userId,
      input.mode,
      input.durationMinutes,
      input.startedAt ?? null,
      input.endedAt ?? createdAt,
      createdAt
    ]
  );
  return row ? mapSession(row) : null;
}

export async function getFocusSummary(userId: string) {
  const sessions = await getFocusSessionsByUser(userId);
  const now = new Date();
  const todayKey = toDateKey(now);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartTime = weekStart.getTime();

  let todayMinutes = 0;
  let weekMinutes = 0;
  let focusCount = 0;
  let breakCount = 0;

  const daySet = new Set<string>();
  sessions.forEach((session) => {
    const ts = new Date(session.createdAt).getTime();
    const key = toDateKey(new Date(session.createdAt));
    if (session.mode === "focus") {
      focusCount += 1;
      if (key === todayKey) todayMinutes += session.durationMinutes;
      if (ts >= weekStartTime) weekMinutes += session.durationMinutes;
      daySet.add(key);
    } else {
      breakCount += 1;
    }
  });

  let streakDays = 0;
  const cursor = new Date(now);
  for (let i = 0; i < 7; i += 1) {
    const key = toDateKey(cursor);
    if (!daySet.has(key)) break;
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const latest = sessions[0];
  let suggestion = "保持节奏，完成一轮专注后记得活动一下。";
  if (todayMinutes >= 90) {
    suggestion = "今天专注已超过 90 分钟，建议安排 15 分钟以上长休息。";
  } else if (latest?.mode === "focus" && latest.durationMinutes >= 25) {
    suggestion = "刚完成一轮番茄，建议起身走动 5-10 分钟。";
  } else if (todayMinutes === 0) {
    suggestion = "今天还没有专注记录，先来一轮 25 分钟。";
  }

  return {
    summary: {
      todayMinutes,
      weekMinutes,
      focusCount,
      breakCount,
      streakDays
    },
    recent: sessions.slice(0, 6),
    suggestion
  };
}
