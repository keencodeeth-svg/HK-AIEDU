import { getClassById, getClassesByStudent } from "./classes";
import type { LearningLibraryItem } from "./learning-library";

type UserLike = {
  id: string;
  role: "student" | "teacher" | "parent" | "admin" | "school_admin";
  schoolId?: string;
  studentId?: string;
};

export async function listAccessibleClassIds(user: UserLike) {
  if (user.role === "teacher") {
    // Teacher reads class scope from authored resources/ownership, not from this helper.
    return [] as string[];
  }
  if (user.role === "student") {
    return (await getClassesByStudent(user.id)).map((item) => item.id);
  }
  if (user.role === "parent" && user.studentId) {
    return (await getClassesByStudent(user.studentId)).map((item) => item.id);
  }
  return [] as string[];
}

export async function canAccessLearningLibraryItem(user: UserLike, item: LearningLibraryItem) {
  if (user.role === "admin") return true;
  if (user.role === "school_admin") {
    if (!user.schoolId) return false;
    const klass = item.classId ? await getClassById(item.classId) : null;
    if (item.accessScope === "global" && !item.classId) return true;
    // School admin can only access resources bound to classes within same school tenant.
    return Boolean(klass && klass.schoolId === user.schoolId);
  }
  if (item.accessScope === "global") return true;
  if (!item.classId) return false;

  if (user.role === "teacher") {
    const klass = await getClassById(item.classId);
    return Boolean(klass && klass.teacherId === user.id);
  }

  if (user.role === "student") {
    const classes = await getClassesByStudent(user.id);
    return classes.some((klass) => klass.id === item.classId);
  }

  if (user.role === "parent" && user.studentId) {
    const classes = await getClassesByStudent(user.studentId);
    return classes.some((klass) => klass.id === item.classId);
  }

  return false;
}
