import crypto from "crypto";
import type { UserRole } from "./auth";
import { isDbEnabled, query } from "./db";
import { readJson, updateJson } from "./storage";

const ANALYTICS_FILE = "analytics-events.json";
const MAX_EVENTS = 50000;
const MAX_BATCH_SIZE = 100;
const MAX_PROPS_SIZE = 4096;
const FUNNEL_DEFINITION = [
  { key: "login_page_view", label: "登录页曝光", eventName: "login_page_view" },
  { key: "login_success", label: "登录成功", eventName: "login_success" },
  { key: "practice_page_view", label: "进入练习", eventName: "practice_page_view" },
  { key: "practice_submit_success", label: "提交答案", eventName: "practice_submit_success" },
  { key: "report_weekly_view", label: "查看周报", eventName: "report_weekly_view" }
] as const;

export type AnalyticsEventRecord = {
  id: string;
  eventName: string;
  eventTime: string;
  receivedAt: string;
  userId: string | null;
  role: UserRole | null;
  subject: string | null;
  grade: string | null;
  page: string | null;
  sessionId: string | null;
  traceId: string | null;
  entityId: string | null;
  props: unknown;
  propsTruncated: boolean;
  userAgent: string | null;
  ip: string | null;
};

export type BuildAnalyticsContext = {
  userId: string | null;
  role: UserRole | null;
  userAgent: string | null;
  ip: string | null;
};

export type AnalyticsFunnelStage = {
  key: string;
  label: string;
  eventName: string;
  users: number;
  conversionFromPrevious: number;
  conversionFromFirst: number;
};

export type AnalyticsFunnelResult = {
  range: { from: string | null; to: string | null };
  filters: { subject: string | null; grade: string | null };
  totalEvents: number;
  totalActors: number;
  stages: AnalyticsFunnelStage[];
};

type DbAnalyticsEvent = {
  id: string;
  event_name: string;
  event_time: string;
  received_at: string;
  user_id: string | null;
  role: string | null;
  subject: string | null;
  grade: string | null;
  page: string | null;
  session_id: string | null;
  trace_id: string | null;
  entity_id: string | null;
  props: unknown;
  props_truncated: boolean;
  user_agent: string | null;
  ip: string | null;
};

type BuildResult =
  | {
      ok: true;
      event: AnalyticsEventRecord;
      propsTruncated: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

function normalizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeIp(raw: string | null) {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first ? first.slice(0, 128) : null;
}

function normalizeProps(value: unknown) {
  if (value === undefined) {
    return { props: null as unknown, truncated: false, dropped: false };
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      return { props: null as unknown, truncated: false, dropped: true };
    }

    if (serialized.length <= MAX_PROPS_SIZE) {
      return { props: value, truncated: false, dropped: false };
    }

    return {
      props: {
        truncated: true,
        preview: serialized.slice(0, MAX_PROPS_SIZE)
      },
      truncated: true,
      dropped: false
    };
  } catch {
    return { props: null as unknown, truncated: false, dropped: true };
  }
}

export function normalizeBatchInput(rawBody: unknown) {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { ok: false as const, error: "invalid body" };
  }

  const body = rawBody as Record<string, unknown>;
  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: false as const, error: "events required" };
  }
  if (events.length > MAX_BATCH_SIZE) {
    return { ok: false as const, error: `too many events (max ${MAX_BATCH_SIZE})` };
  }
  return { ok: true as const, events };
}

export function buildAnalyticsEvent(rawEvent: unknown, context: BuildAnalyticsContext): BuildResult {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    return { ok: false, reason: "invalid event" };
  }

  const input = rawEvent as Record<string, unknown>;
  const eventName = normalizeString(input.eventName, 80);
  if (!eventName) {
    return { ok: false, reason: "eventName required" };
  }

  const eventTime = input.eventTime ? normalizeTimestamp(input.eventTime) : new Date().toISOString();
  if (!eventTime) {
    return { ok: false, reason: "invalid eventTime" };
  }

  const propsState = normalizeProps(input.props);
  if (propsState.dropped) {
    return { ok: false, reason: "invalid props" };
  }

  const event: AnalyticsEventRecord = {
    id: `evt-${crypto.randomBytes(8).toString("hex")}`,
    eventName,
    eventTime,
    receivedAt: new Date().toISOString(),
    userId: context.userId,
    role: context.role,
    subject: normalizeString(input.subject, 32),
    grade: normalizeString(input.grade, 16),
    page: normalizeString(input.page, 256),
    sessionId: normalizeString(input.sessionId, 128),
    traceId: normalizeString(input.traceId, 128),
    entityId: normalizeString(input.entityId, 128),
    props: propsState.props,
    propsTruncated: propsState.truncated,
    userAgent: context.userAgent,
    ip: context.ip
  };

  return { ok: true, event, propsTruncated: propsState.truncated };
}

export async function appendAnalyticsEvents(events: AnalyticsEventRecord[]) {
  if (!events.length) return;

  if (isDbEnabled()) {
    for (const event of events) {
      await query(
        `INSERT INTO analytics_events
         (id, event_name, event_time, received_at, user_id, role, subject, grade, page, session_id, trace_id, entity_id, props, props_truncated, user_agent, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16)`,
        [
          event.id,
          event.eventName,
          event.eventTime,
          event.receivedAt,
          event.userId,
          event.role,
          event.subject,
          event.grade,
          event.page,
          event.sessionId,
          event.traceId,
          event.entityId,
          JSON.stringify(event.props ?? null),
          event.propsTruncated,
          event.userAgent,
          event.ip
        ]
      );
    }
    await query(
      `DELETE FROM analytics_events
       WHERE id IN (
         SELECT id
         FROM analytics_events
         ORDER BY event_time DESC, received_at DESC
         OFFSET $1
       )`,
      [MAX_EVENTS]
    );
    return;
  }

  await updateJson<AnalyticsEventRecord[]>(ANALYTICS_FILE, [], (list) => {
    list.push(...events);
    return list.length > MAX_EVENTS ? list.slice(list.length - MAX_EVENTS) : list;
  });
}

function mapDbAnalyticsEvent(row: DbAnalyticsEvent): AnalyticsEventRecord {
  const parsedProps =
    typeof row.props === "string"
      ? (() => {
          try {
            return JSON.parse(row.props) as unknown;
          } catch {
            return row.props;
          }
        })()
      : row.props;
  return {
    id: row.id,
    eventName: row.event_name,
    eventTime: row.event_time,
    receivedAt: row.received_at,
    userId: row.user_id,
    role: row.role as UserRole | null,
    subject: row.subject,
    grade: row.grade,
    page: row.page,
    sessionId: row.session_id,
    traceId: row.trace_id,
    entityId: row.entity_id,
    props: parsedProps,
    propsTruncated: Boolean(row.props_truncated),
    userAgent: row.user_agent,
    ip: row.ip
  };
}

export async function getAnalyticsEvents(options: {
  from?: string;
  to?: string;
  subject?: string;
  grade?: string;
} = {}) {
  const fromTs = options.from ? new Date(options.from).getTime() : null;
  const toTs = options.to ? new Date(options.to).getTime() : null;
  const subject = options.subject?.trim() || null;
  const grade = options.grade?.trim() || null;

  if (!isDbEnabled()) {
    return readJson<AnalyticsEventRecord[]>(ANALYTICS_FILE, []).filter((event) => {
      const eventTs = new Date(event.eventTime).getTime();
      if (Number.isNaN(eventTs)) return false;
      if (fromTs !== null && eventTs < fromTs) return false;
      if (toTs !== null && eventTs > toTs) return false;
      if (subject && event.subject !== subject) return false;
      if (grade && event.grade !== grade) return false;
      return true;
    });
  }

  const where: string[] = [];
  const params: Array<string> = [];
  if (fromTs !== null) {
    where.push(`event_time >= $${params.length + 1}`);
    params.push(new Date(fromTs).toISOString());
  }
  if (toTs !== null) {
    where.push(`event_time <= $${params.length + 1}`);
    params.push(new Date(toTs).toISOString());
  }
  if (subject) {
    where.push(`subject = $${params.length + 1}`);
    params.push(subject);
  }
  if (grade) {
    where.push(`grade = $${params.length + 1}`);
    params.push(grade);
  }

  const sql = `
    SELECT *
    FROM analytics_events
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY event_time ASC
  `;
  const rows = await query<DbAnalyticsEvent>(sql, params);
  return rows.map(mapDbAnalyticsEvent);
}

function getActorKey(event: AnalyticsEventRecord) {
  if (event.userId) return `u:${event.userId}`;
  if (event.sessionId) return `s:${event.sessionId}`;
  if (event.ip) return `ip:${event.ip}`;
  return `e:${event.id}`;
}

function roundPercentage(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getAnalyticsFunnel(options: {
  from?: string;
  to?: string;
  subject?: string;
  grade?: string;
}): Promise<AnalyticsFunnelResult> {
  const subject = options.subject?.trim() || null;
  const grade = options.grade?.trim() || null;
  const filtered = await getAnalyticsEvents(options);

  const stagePresence = new Map<string, Set<string>>();
  for (const stage of FUNNEL_DEFINITION) {
    stagePresence.set(stage.eventName, new Set<string>());
  }

  filtered.forEach((event) => {
    const actorKey = getActorKey(event);
    const set = stagePresence.get(event.eventName);
    if (set) {
      set.add(actorKey);
    }
  });

  const actorProgress = new Map<string, number>();
  const allActors = new Set<string>();

  for (const event of filtered) {
    allActors.add(getActorKey(event));
  }

  allActors.forEach((actorKey) => {
    let reached = 0;
    for (const stage of FUNNEL_DEFINITION) {
      const reachedThisStage = stagePresence.get(stage.eventName)?.has(actorKey) ?? false;
      if (!reachedThisStage) {
        break;
      }
      reached += 1;
    }
    actorProgress.set(actorKey, reached);
  });

  const baseFirst = Array.from(actorProgress.values()).filter((value) => value >= 1).length;
  const stages: AnalyticsFunnelStage[] = FUNNEL_DEFINITION.map((stage, index) => {
    const users = Array.from(actorProgress.values()).filter((value) => value >= index + 1).length;
    const previousUsers =
      index === 0
        ? users
        : Array.from(actorProgress.values()).filter((value) => value >= index).length;

    const conversionFromPrevious =
      index === 0 ? 100 : previousUsers === 0 ? 0 : roundPercentage((users / previousUsers) * 100);
    const conversionFromFirst = baseFirst === 0 ? 0 : roundPercentage((users / baseFirst) * 100);

    return {
      key: stage.key,
      label: stage.label,
      eventName: stage.eventName,
      users,
      conversionFromPrevious,
      conversionFromFirst
    };
  });

  return {
    range: {
      from: options.from ?? null,
      to: options.to ?? null
    },
    filters: {
      subject,
      grade
    },
    totalEvents: filtered.length,
    totalActors: allActors.size,
    stages
  };
}

export function buildAnalyticsContext(input: {
  userId: string | null;
  role: UserRole | null;
  userAgent?: string | null;
  forwardedFor?: string | null;
}): BuildAnalyticsContext {
  return {
    userId: input.userId,
    role: input.role,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
    ip: normalizeIp(input.forwardedFor ?? null)
  };
}
