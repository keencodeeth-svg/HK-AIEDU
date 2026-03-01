import { getCurrentUser } from "./auth";
import type { UserRole } from "./auth";
import { getAssignmentById } from "./assignments";
import { getClassById, getClassStudentIds, getClassesByStudent } from "./classes";
import { forbidden, notFound, unauthorized } from "./api/http";
import { getModuleById } from "./modules";

export async function requireRole(role: UserRole) {
  const user = await getCurrentUser();
  if (!user || user.role !== role) {
    return null;
  }
  return user;
}

export async function requireRoleOrThrow(role: UserRole) {
  const user = await requireRole(role);
  if (!user) {
    unauthorized();
  }
  return user;
}

export async function requireSchoolAdminOrPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "school_admin")) {
    unauthorized();
  }
  return user;
}

export function assertSameSchool(
  user: { role: UserRole; schoolId?: string },
  resourceSchoolId: string | null | undefined
) {
  // Platform admin can operate cross-tenant; all other roles are school-scoped.
  if (user.role === "admin") return;
  if (!resourceSchoolId || !user.schoolId || user.schoolId !== resourceSchoolId) {
    forbidden("跨学校访问已禁止");
  }
}

export async function requireTeacherClass(classId: string) {
  const teacher = await requireRoleOrThrow("teacher");
  const klass = await getClassById(classId);
  if (!klass || klass.teacherId !== teacher.id) {
    notFound("class not found");
  }
  return { teacher, klass };
}

export async function requireTeacherStudentInClass(classId: string, studentId: string) {
  const { teacher, klass } = await requireTeacherClass(classId);
  const studentIds = await getClassStudentIds(klass.id);
  if (!studentIds.includes(studentId)) {
    notFound("student not in class");
  }
  return { teacher, klass, studentIds };
}

export async function requireStudentClass(classId: string) {
  const student = await requireRoleOrThrow("student");
  const classes = await getClassesByStudent(student.id);
  const klass = classes.find((item) => item.id === classId);
  if (!klass) {
    notFound("class not found");
  }
  return { student, klass };
}

export async function requireTeacherAssignment(assignmentId: string) {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) {
    notFound("not found");
  }
  const { teacher, klass } = await requireTeacherClass(assignment.classId);
  return { teacher, klass, assignment };
}

export async function requireStudentAssignment(assignmentId: string) {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) {
    notFound("not found");
  }
  const { student, klass } = await requireStudentClass(assignment.classId);
  return { student, klass, assignment };
}

export async function requireTeacherModule(moduleId: string) {
  const moduleRecord = await getModuleById(moduleId);
  if (!moduleRecord) {
    notFound("not found");
  }
  const { teacher, klass } = await requireTeacherClass(moduleRecord.classId);
  return { teacher, klass, moduleRecord };
}

export async function requireStudentModule(moduleId: string) {
  const moduleRecord = await getModuleById(moduleId);
  if (!moduleRecord) {
    notFound("not found");
  }
  const { student, klass } = await requireStudentClass(moduleRecord.classId);
  return { student, klass, moduleRecord };
}
