import crypto from "crypto";
import { cookies } from "next/headers";
import { readJson, updateJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
export { hashPassword, verifyPassword } from "./password";

export type UserRole = "student" | "parent" | "admin" | "teacher" | "school_admin";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string; // use plain:xxx for MVP or salt:hash for scrypt
  grade?: string;
  schoolId?: string;
  studentId?: string; // for parent binding
};

export type Session = {
  id: string;
  userId: string;
  role: UserRole;
  expiresAt: string;
};

const USER_FILE = "users.json";
const SESSION_FILE = "sessions.json";
const SESSION_COOKIE = "mvp_session";
const SESSION_TTL_DAYS = 7;

type DbUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
  grade: string | null;
  school_id: string | null;
  student_id: string | null;
};

type DbSession = {
  id: string;
  user_id: string;
  role: UserRole;
  expires_at: string;
};

function mapUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    password: row.password,
    grade: row.grade ?? undefined,
    schoolId: row.school_id ?? undefined,
    studentId: row.student_id ?? undefined
  };
}

export async function getUsers(): Promise<User[]> {
  if (!isDbEnabled()) {
    return readJson<User[]>(USER_FILE, []);
  }
  const rows = await query<DbUser>("SELECT * FROM users");
  return rows.map(mapUser);
}

export async function saveUsers(users: User[]) {
  if (!isDbEnabled()) {
    writeJson(USER_FILE, users);
  }
}

export async function getSessions(): Promise<Session[]> {
  if (!isDbEnabled()) {
    return readJson<Session[]>(SESSION_FILE, []);
  }
  const rows = await query<DbSession>("SELECT * FROM sessions");
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    expiresAt: row.expires_at
  }));
}

export async function saveSessions(sessions: Session[]) {
  if (!isDbEnabled()) {
    writeJson(SESSION_FILE, sessions);
  }
}

export async function createUser(user: User) {
  if (!isDbEnabled()) {
    await updateJson<User[]>(USER_FILE, [], (users) => {
      users.push(user);
    });
    return user;
  }

  await query(
    `INSERT INTO users (id, email, name, role, password, grade, school_id, student_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      user.password,
      user.grade ?? null,
      user.schoolId ?? null,
      user.studentId ?? null
    ]
  );
  return user;
}

export async function createSession(user: User) {
  const id = crypto.randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  if (!isDbEnabled()) {
    await updateJson<Session[]>(SESSION_FILE, [], (sessions) => {
      const nextSessions = sessions.filter((session) => session.userId !== user.id);
      nextSessions.push({ id, userId: user.id, role: user.role, expiresAt });
      return nextSessions;
    });
    return { id, expiresAt };
  }

  // Enforce one active session per user to keep cookie/session behavior deterministic.
  await query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
  await query(
    "INSERT INTO sessions (id, user_id, role, expires_at) VALUES ($1, $2, $3, $4)",
    [id, user.id, user.role, expiresAt]
  );
  return { id, expiresAt };
}

export async function getSessionByToken(token?: string | null) {
  if (!token) return null;

  if (!isDbEnabled()) {
    const sessions = await getSessions();
    const session = sessions.find((item) => item.id === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      // Lazy cleanup: remove expired session at read time to avoid background jobs in MVP mode.
      await removeSession(token);
      return null;
    }
    return session;
  }

  const row = await queryOne<DbSession>("SELECT * FROM sessions WHERE id = $1", [token]);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    // Keep DB and cookie state aligned when an expired token is presented.
    await removeSession(token);
    return null;
  }
  return { id: row.id, userId: row.user_id, role: row.role, expiresAt: row.expires_at };
}

export async function removeSession(token: string) {
  if (!isDbEnabled()) {
    await updateJson<Session[]>(SESSION_FILE, [], (sessions) =>
      sessions.filter((item) => item.id !== token)
    );
    return;
  }
  await query("DELETE FROM sessions WHERE id = $1", [token]);
}

export function setSessionCookie(response: Response, token: string) {
  const nextResponse = response as any;
  if (nextResponse.cookies?.set) {
    nextResponse.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
    });
  }
}

export function clearSessionCookie(response: Response) {
  const nextResponse = response as any;
  if (nextResponse.cookies?.set) {
    nextResponse.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0
    });
  }
}

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionByToken(token);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export async function getUserById(id: string) {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbUser>("SELECT * FROM users WHERE id = $1", [id]);
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string) {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const row = await queryOne<DbUser>("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  return row ? mapUser(row) : null;
}

export async function getAdminCount() {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users.filter((user) => user.role === "admin").length;
  }
  const row = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  return Number(row?.count ?? 0);
}

export async function getTeacherCount() {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users.filter((user) => user.role === "teacher").length;
  }
  const row = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
  return Number(row?.count ?? 0);
}

export async function getSchoolAdminCount(schoolId?: string) {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users.filter(
      (user) => user.role === "school_admin" && (!schoolId || (user.schoolId ?? null) === schoolId)
    ).length;
  }
  if (schoolId) {
    const row = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'school_admin' AND school_id = $1",
      [schoolId]
    );
    return Number(row?.count ?? 0);
  }
  const row = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'school_admin'");
  return Number(row?.count ?? 0);
}

export async function getParentsByStudentId(studentId: string) {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users.filter((user) => user.role === "parent" && user.studentId === studentId);
  }
  const rows = await query<DbUser>("SELECT * FROM users WHERE role = 'parent' AND student_id = $1", [studentId]);
  return rows.map(mapUser);
}

export async function updateUserPassword(userId: string, password: string) {
  if (!isDbEnabled()) {
    const users = await getUsers();
    const index = users.findIndex((item) => item.id === userId);
    if (index === -1) return false;
    users[index] = { ...users[index], password };
    await saveUsers(users);
    return true;
  }
  const rows = await query<{ id: string }>("UPDATE users SET password = $2 WHERE id = $1 RETURNING id", [
    userId,
    password
  ]);
  return rows.length > 0;
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
