import { getUsers } from "./auth";
import { getAssignments } from "./assignments";
import { getClassStudentIds, getClasses } from "./classes";
import { isDbEnabled, query } from "./db";
import type {
  SchoolActionItem,
  SchoolAttentionClass,
  SchoolClassRecord,
  SchoolOverview,
  SchoolUserRecord
} from "./school-admin-types";

const OVERLOADED_CLASS_THRESHOLD = 45;

type DbOverviewRow = {
  teacher_count: string;
  student_count: string;
  parent_count: string;
  class_count: string;
  assignment_count: string;
};

type DbSchoolUser = {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "student" | "parent" | "school_admin";
  grade: string | null;
  created_at: string | null;
};

type DbSchoolClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacher_id: string | null;
  teacher_name: string | null;
  created_at: string;
  student_count: string;
  assignment_count: string;
};

function roundNumber(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toRate(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function issueTagBundle(item: SchoolClassRecord) {
  const issueTags: string[] = [];
  let severity = 0;

  if (!item.teacherId) {
    issueTags.push("待绑定教师");
    severity += 4;
  }
  if (item.studentCount === 0) {
    issueTags.push("暂无学生");
    severity += 3;
  }
  if (item.assignmentCount === 0) {
    issueTags.push("未布置作业");
    severity += 2;
  }
  if (item.studentCount >= OVERLOADED_CLASS_THRESHOLD) {
    issueTags.push("人数偏高");
    severity += 1 + Math.ceil((item.studentCount - OVERLOADED_CLASS_THRESHOLD) / 10);
  }

  return { issueTags, severity };
}

function buildAttentionClasses(classes: SchoolClassRecord[]): SchoolAttentionClass[] {
  return classes
    .map((item) => {
      const { issueTags, severity } = issueTagBundle(item);
      return {
        ...item,
        issueTags,
        severity
      };
    })
    .filter((item) => item.issueTags.length > 0)
    .sort((left, right) => {
      if (right.severity !== left.severity) return right.severity - left.severity;
      if (right.studentCount !== left.studentCount) return right.studentCount - left.studentCount;
      return left.name.localeCompare(right.name, "zh-CN");
    })
    .slice(0, 5)
    .map(({ severity: _severity, ...item }) => item);
}

function buildActionItems(
  schoolId: string,
  classes: SchoolClassRecord[],
  classCount: number,
  assignmentCount: number
): SchoolActionItem[] {
  const classesWithoutTeacherCount = classes.filter((item) => !item.teacherId).length;
  const classesWithoutStudentsCount = classes.filter((item) => item.studentCount === 0).length;
  const classesWithoutAssignmentsCount = classes.filter((item) => item.assignmentCount === 0).length;
  const overloadedClassCount = classes.filter((item) => item.studentCount >= OVERLOADED_CLASS_THRESHOLD).length;

  const items: SchoolActionItem[] = [];

  if (classCount === 0) {
    items.push({
      id: `school-${schoolId}-create-first-class`,
      tone: "critical",
      title: "先完成首个班级建档",
      description: "当前学校还没有班级，学校端无法形成排课、作业和成员协同闭环。",
      href: "/school/classes",
      ctaLabel: "查看班级页"
    });
  }

  if (classesWithoutTeacherCount > 0) {
    items.push({
      id: `school-${schoolId}-bind-teachers`,
      tone: "critical",
      title: `${classesWithoutTeacherCount} 个班级待绑定教师`,
      description: "先补齐教师负责人，避免班级失管或后续作业下发断档。",
      href: "/school/teachers",
      ctaLabel: "分配教师",
      count: classesWithoutTeacherCount
    });
  }

  if (classesWithoutStudentsCount > 0) {
    items.push({
      id: `school-${schoolId}-fill-roster`,
      tone: "warning",
      title: `${classesWithoutStudentsCount} 个班级暂无学生`,
      description: "建议检查导入、分班或邀请码流转，避免空班级影响排课和统计。",
      href: "/school/students",
      ctaLabel: "核对学生",
      count: classesWithoutStudentsCount
    });
  }

  if (classesWithoutAssignmentsCount > 0) {
    items.push({
      id: `school-${schoolId}-cover-assignments`,
      tone: "info",
      title: `${classesWithoutAssignmentsCount} 个班级尚未布置作业`,
      description: "教学任务覆盖不均，建议优先跟进尚未开始作业执行的班级。",
      href: "/school/classes",
      ctaLabel: "查看班级负载",
      count: classesWithoutAssignmentsCount
    });
  }

  if (overloadedClassCount > 0) {
    items.push({
      id: `school-${schoolId}-balance-load`,
      tone: "warning",
      title: `${overloadedClassCount} 个班级人数偏高`,
      description: "建议关注大班额班级的教师负载和作业批改压力，必要时拆分或增派支持。",
      href: "/school/classes",
      ctaLabel: "查看高负载班级",
      count: overloadedClassCount
    });
  }

  if (!items.length) {
    items.push({
      id: `school-${schoolId}-healthy`,
      tone: "success",
      title: "学校运营状态稳定",
      description: "班级编排、教师绑定和作业覆盖目前均处于健康范围，可继续优化质量细节。",
      href: "/school",
      ctaLabel: "保持巡检"
    });
  }

  return items.slice(0, 4);
}

function buildOverviewFromCounts(input: {
  schoolId: string;
  teacherCount: number;
  studentCount: number;
  parentCount: number;
  classCount: number;
  assignmentCount: number;
  classes: SchoolClassRecord[];
}): SchoolOverview {
  const classesWithoutTeacherCount = input.classes.filter((item) => !item.teacherId).length;
  const classesWithoutStudentsCount = input.classes.filter((item) => item.studentCount === 0).length;
  const classesWithoutAssignmentsCount = input.classes.filter((item) => item.assignmentCount === 0).length;
  const overloadedClassCount = input.classes.filter((item) => item.studentCount >= OVERLOADED_CLASS_THRESHOLD).length;
  const classesWithTeacherCount = input.classes.filter((item) => item.teacherId).length;
  const classesWithAssignmentsCount = input.classes.filter((item) => item.assignmentCount > 0).length;
  const totalStudentsInClasses = input.classes.reduce((sum, item) => sum + item.studentCount, 0);
  const totalAssignmentsInClasses = input.classes.reduce((sum, item) => sum + item.assignmentCount, 0);

  return {
    schoolId: input.schoolId,
    teacherCount: input.teacherCount,
    studentCount: input.studentCount,
    parentCount: input.parentCount,
    classCount: input.classCount,
    assignmentCount: input.assignmentCount,
    classesWithoutTeacherCount,
    classesWithoutStudentsCount,
    classesWithoutAssignmentsCount,
    overloadedClassCount,
    averageStudentsPerClass: input.classCount ? roundNumber(totalStudentsInClasses / input.classCount) : 0,
    averageAssignmentsPerClass: input.classCount ? roundNumber(totalAssignmentsInClasses / input.classCount) : 0,
    teacherCoverageRate: toRate(classesWithTeacherCount, input.classCount),
    assignmentCoverageRate: toRate(classesWithAssignmentsCount, input.classCount),
    actionItems: buildActionItems(input.schoolId, input.classes, input.classCount, input.assignmentCount),
    attentionClasses: buildAttentionClasses(input.classes)
  };
}

export async function getSchoolOverview(schoolId: string): Promise<SchoolOverview> {
  if (!isDbEnabled()) {
    const [users, classes, assignments] = await Promise.all([getUsers(), listSchoolClasses(schoolId), getAssignments()]);
    const classIds = new Set(classes.map((item) => item.id));
    const schoolUsers = users.filter((item) => item.schoolId === schoolId);
    return buildOverviewFromCounts({
      schoolId,
      teacherCount: schoolUsers.filter((item) => item.role === "teacher").length,
      studentCount: schoolUsers.filter((item) => item.role === "student").length,
      parentCount: schoolUsers.filter((item) => item.role === "parent").length,
      classCount: classes.length,
      assignmentCount: assignments.filter((item) => classIds.has(item.classId)).length,
      classes
    });
  }

  const [rows, classes] = await Promise.all([
    query<DbOverviewRow>(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = 'teacher') as teacher_count,
        (SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = 'student') as student_count,
        (SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = 'parent') as parent_count,
        (SELECT COUNT(*) FROM classes WHERE school_id = $1) as class_count,
        (SELECT COUNT(*) FROM assignments a JOIN classes c ON a.class_id = c.id WHERE c.school_id = $1) as assignment_count`,
      [schoolId]
    ),
    listSchoolClasses(schoolId)
  ]);

  const row = rows[0];

  return buildOverviewFromCounts({
    schoolId,
    teacherCount: Number(row?.teacher_count ?? 0),
    studentCount: Number(row?.student_count ?? 0),
    parentCount: Number(row?.parent_count ?? 0),
    classCount: Number(row?.class_count ?? 0),
    assignmentCount: Number(row?.assignment_count ?? 0),
    classes
  });
}

export async function listSchoolUsers(
  schoolId: string,
  role?: "teacher" | "student" | "parent" | "school_admin"
): Promise<SchoolUserRecord[]> {
  if (!isDbEnabled()) {
    const users = await getUsers();
    return users
      .filter((item) => item.schoolId === schoolId)
      .filter((item) => (role ? item.role === role : ["teacher", "student", "parent", "school_admin"].includes(item.role)))
      .map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role as SchoolUserRecord["role"],
        grade: item.grade
      }));
  }
  const rows = role
    ? await query<DbSchoolUser>(
        `SELECT id, name, email, role, grade, created_at
         FROM users
         WHERE school_id = $1 AND role = $2
         ORDER BY created_at DESC`,
        [schoolId, role]
      )
    : await query<DbSchoolUser>(
        `SELECT id, name, email, role, grade, created_at
         FROM users
         WHERE school_id = $1 AND role = ANY($2)
         ORDER BY created_at DESC`,
        [schoolId, ["teacher", "student", "parent", "school_admin"]]
      );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    grade: row.grade ?? undefined,
    createdAt: row.created_at ?? undefined
  }));
}

export async function listSchoolClasses(schoolId: string): Promise<SchoolClassRecord[]> {
  if (!isDbEnabled()) {
    const [classes, assignments, users] = await Promise.all([getClasses({ schoolId }), getAssignments(), getUsers()]);
    const teacherNameById = new Map(
      users.filter((item) => item.schoolId === schoolId && item.role === "teacher").map((item) => [item.id, item.name])
    );

    return Promise.all(
      classes.map(async (klass) => {
        const studentIds = await getClassStudentIds(klass.id);
        return {
          id: klass.id,
          name: klass.name,
          subject: klass.subject,
          grade: klass.grade,
          teacherId: klass.teacherId,
          teacherName: klass.teacherId ? teacherNameById.get(klass.teacherId) : undefined,
          studentCount: studentIds.length,
          assignmentCount: assignments.filter((item) => item.classId === klass.id).length,
          createdAt: klass.createdAt
        };
      })
    );
  }

  const rows = await query<DbSchoolClass>(
    `SELECT
      c.id,
      c.name,
      c.subject,
      c.grade,
      c.teacher_id,
      u.name as teacher_name,
      c.created_at,
      COUNT(DISTINCT cs.student_id) as student_count,
      COUNT(DISTINCT a.id) as assignment_count
     FROM classes c
     LEFT JOIN users u ON u.id = c.teacher_id
     LEFT JOIN class_students cs ON cs.class_id = c.id
     LEFT JOIN assignments a ON a.class_id = c.id
     WHERE c.school_id = $1
     GROUP BY c.id, u.name
     ORDER BY c.created_at DESC`,
    [schoolId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    grade: row.grade,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name ?? undefined,
    studentCount: Number(row.student_count ?? 0),
    assignmentCount: Number(row.assignment_count ?? 0),
    createdAt: row.created_at
  }));
}
