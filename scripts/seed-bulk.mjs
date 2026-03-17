import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");

const TEACHER_COUNT = Number(process.env.SEED_TEACHERS ?? 2);
const STUDENT_COUNT = Number(process.env.SEED_STUDENTS ?? 24);
const PARENT_COUNT = Number(process.env.SEED_PARENTS ?? 8);
const CLASS_COUNT = Number(process.env.SEED_CLASSES ?? 4);
const ASSIGNMENT_COUNT = Number(process.env.SEED_ASSIGNMENTS ?? 8);
const QUESTIONS_PER_KP = Number(process.env.SEED_QUESTIONS_PER_KP ?? 4);
const SUBJECTS = (process.env.SEED_SUBJECTS ?? "math,chinese,english").split(",").map((s) => s.trim()).filter(Boolean);
const GRADES = (process.env.SEED_GRADES ?? "4,7,10").split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_SCHOOL_ID = process.env.SEED_SCHOOL_ID ?? "school-default";
const DEFAULT_SCHOOL_CODE = process.env.SEED_SCHOOL_CODE ?? "DEFAULT";
const DEFAULT_SCHOOL_NAME = process.env.SEED_SCHOOL_NAME ?? "默认学校";

const now = new Date();
const iso = (date) => new Date(date).toISOString();
const daysAgo = (n) => iso(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => iso(Date.now() + n * 24 * 60 * 60 * 1000);

const makeId = (prefix, index) => `${prefix}-${String(index).padStart(3, "0")}`;
const BASE64_TEXT = Buffer.from("示例作业内容").toString("base64");

const readJson = (file, fallback) => {
  const runtimePath = path.join(runtimeDir, file);
  if (fs.existsSync(runtimePath)) {
    return JSON.parse(fs.readFileSync(runtimePath, "utf-8"));
  }
  const seedPath = path.join(seedDir, file);
  if (!fs.existsSync(seedPath)) return fallback;
  return JSON.parse(fs.readFileSync(seedPath, "utf-8"));
};

const writeJson = (file, data) => {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, file), JSON.stringify(data, null, 2));
};

const upsert = (list, matcher, item) => {
  const index = list.findIndex(matcher);
  if (index >= 0) {
    list[index] = { ...list[index], ...item };
  } else {
    list.push(item);
  }
};

const subjectCycle = (index) => SUBJECTS[index % SUBJECTS.length] ?? "math";
const gradeCycle = (index) => GRADES[index % GRADES.length] ?? "4";

function buildKnowledgePoints() {
  const points = [];
  SUBJECTS.forEach((subject) => {
    GRADES.forEach((grade) => {
      for (let i = 1; i <= 3; i += 1) {
        points.push({
          id: `kp-${subject}-${grade}-${i}`,
          subject,
          grade,
          title: `${subject.toUpperCase()} 基础概念 ${i}`,
          chapter: `单元 ${i}`,
          unit: `单元 ${i}`
        });
      }
    });
  });
  return points;
}

function buildQuestions(knowledgePoints) {
  const questions = [];
  knowledgePoints.forEach((kp) => {
    for (let i = 1; i <= QUESTIONS_PER_KP; i += 1) {
      questions.push({
        id: `q-${kp.subject}-${kp.grade}-${kp.id}-${i}`,
        subject: kp.subject,
        grade: kp.grade,
        knowledgePointId: kp.id,
        stem: `${kp.title} 题目 ${i}：选择正确答案。`,
        options: ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
        answer: "A",
        explanation: "选项一为正确答案。",
        difficulty: "medium",
        questionType: "choice",
        tags: [],
        abilities: []
      });
    }
  });
  return questions;
}

function buildUsers() {
  const teachers = Array.from({ length: TEACHER_COUNT }, (_, idx) => ({
    id: makeId("u-teacher-bulk", idx + 1),
    email: `teacher${idx + 1}@demo.com`,
    name: `老师${idx + 1}`,
    role: "teacher",
    schoolId: DEFAULT_SCHOOL_ID,
    password: "plain:Teacher123"
  }));

  const students = Array.from({ length: STUDENT_COUNT }, (_, idx) => ({
    id: makeId("u-student-bulk", idx + 1),
    email: `student${idx + 1}@demo.com`,
    name: `学生${idx + 1}`,
    role: "student",
    grade: gradeCycle(idx),
    schoolId: DEFAULT_SCHOOL_ID,
    password: "plain:Student123"
  }));

  const parents = Array.from({ length: Math.min(PARENT_COUNT, STUDENT_COUNT) }, (_, idx) => ({
    id: makeId("u-parent-bulk", idx + 1),
    email: `parent${idx + 1}@demo.com`,
    name: `家长${idx + 1}`,
    role: "parent",
    schoolId: DEFAULT_SCHOOL_ID,
    studentId: students[idx].id,
    password: "plain:Parent123"
  }));

  return { teachers, students, parents };
}

function buildStudentProfiles(students) {
  return students.map((student, idx) => ({
    id: `sp-${student.id}`,
    userId: student.id,
    grade: student.grade ?? gradeCycle(idx),
    subjects: SUBJECTS,
    target: "巩固基础、提升成绩",
    school: "航科实验学校",
    observerCode: `HKOB${String(idx + 1).padStart(3, "0")}`,
    updatedAt: iso(now)
  }));
}

function buildClasses(teachers) {
  const classes = [];
  for (let i = 0; i < CLASS_COUNT; i += 1) {
    const teacher = teachers[i % teachers.length];
    classes.push({
      id: makeId("class-bulk", i + 1),
      name: `测试班级 ${i + 1}`,
      subject: subjectCycle(i),
      grade: gradeCycle(i),
      schoolId: teacher.schoolId ?? DEFAULT_SCHOOL_ID,
      teacherId: teacher.id,
      createdAt: iso(now),
      joinCode: `JOIN${String(i + 1).padStart(2, "0")}`,
      joinMode: i % 2 === 0 ? "auto" : "approval"
    });
  }
  return classes;
}

function buildModules(classes) {
  const modules = [];
  const resources = [];
  classes.forEach((klass, idx) => {
    for (let i = 1; i <= 2; i += 1) {
      const moduleId = `${klass.id}-mod-${i}`;
      modules.push({
        id: moduleId,
        classId: klass.id,
        parentId: null,
        title: `${klass.name} 单元 ${i}`,
        description: "本单元核心知识与作业安排。",
        orderIndex: i,
        createdAt: iso(now)
      });
      resources.push({
        id: `${moduleId}-res-1`,
        moduleId,
        title: "课件链接",
        resourceType: "link",
        linkUrl: "https://example.com",
        createdAt: iso(now)
      });
      if (idx % 2 === 0) {
        resources.push({
          id: `${moduleId}-res-2`,
          moduleId,
          title: "示例资料",
          resourceType: "file",
          fileName: "资料.txt",
          mimeType: "text/plain",
          size: BASE64_TEXT.length,
          contentBase64: BASE64_TEXT,
          createdAt: iso(now)
        });
      }
    }
  });
  return { modules, resources };
}

function buildAssignments(classes, questionsByKey, modulesByClass) {
  const assignments = [];
  const assignmentItems = [];
  const assignmentRubrics = [];

  let assignmentIndex = 0;
  for (const klass of classes) {
    const perClass = Math.ceil(ASSIGNMENT_COUNT / classes.length);
    for (let i = 0; i < perClass && assignmentIndex < ASSIGNMENT_COUNT; i += 1) {
      assignmentIndex += 1;
      const submissionType = ["quiz", "upload", "essay"][assignmentIndex % 3];
      const id = makeId("assign-bulk", assignmentIndex);
      const dueDate = daysAhead(assignmentIndex + 2);
      const moduleList = modulesByClass.get(klass.id) ?? [];
      const moduleId = moduleList.length ? moduleList[i % moduleList.length].id : null;
      assignments.push({
        id,
        classId: klass.id,
        moduleId,
        title: `${klass.name} 作业 ${assignmentIndex}`,
        description: "自动生成的测试作业。",
        dueDate,
        createdAt: iso(now),
        submissionType,
        maxUploads: submissionType === "upload" ? 2 : 3,
        gradingFocus: submissionType === "essay" ? "结构与表达" : "计算与步骤"
      });

      if (submissionType === "quiz") {
        const poolKey = `${klass.subject}-${klass.grade}`;
        const pool = questionsByKey.get(poolKey) ?? [];
        pool.slice(0, 5).forEach((question, idx) => {
          assignmentItems.push({
            id: `${id}-item-${idx + 1}`,
            assignmentId: id,
            questionId: question.id
          });
        });
      } else {
        const rubrics =
          submissionType === "essay"
            ? [
                { title: "结构与逻辑", description: "段落层次与结构完整", maxScore: 10 },
                { title: "内容与观点", description: "观点清晰、内容充实", maxScore: 10 },
                { title: "语言表达", description: "语句通顺、表达准确", maxScore: 10 }
              ]
            : [
                { title: "完成度", description: "题目完成情况", maxScore: 10 },
                { title: "准确性", description: "计算与表达准确", maxScore: 10 },
                { title: "规范性", description: "书写与步骤规范", maxScore: 10 }
              ];
        rubrics.forEach((rubric, idx) => {
          assignmentRubrics.push({
            id: `${id}-rubric-${idx + 1}`,
            assignmentId: id,
            title: rubric.title,
            description: rubric.description,
            maxScore: rubric.maxScore,
            weight: 1,
            createdAt: iso(now)
          });
        });
      }
    }
  }

  return { assignments, assignmentItems, assignmentRubrics };
}

function buildProgressAndSubmissions(classes, students, assignments, questionsByKey, assignmentRubrics) {
  const classStudents = [];
  const progress = [];
  const submissions = [];
  const uploads = [];
  const reviews = [];
  const reviewItems = [];
  const reviewRubrics = [];

  const classMap = new Map(classes.map((item) => [item.id, item]));
  const studentsByClass = new Map();
  classes.forEach((klass, idx) => {
    const slice = students.filter((_, sidx) => sidx % classes.length === idx);
    studentsByClass.set(klass.id, slice);
    slice.forEach((student, sidx) => {
      classStudents.push({
        id: `${klass.id}-student-${sidx + 1}`,
        classId: klass.id,
        studentId: student.id,
        joinedAt: iso(now)
      });
    });
  });

  assignments.forEach((assignment, aidx) => {
    const klass = classMap.get(assignment.classId);
    const classList = studentsByClass.get(assignment.classId) ?? [];
    const poolKey = `${klass.subject}-${klass.grade}`;
    const pool = questionsByKey.get(poolKey) ?? [];
    const quizQuestions = pool.slice(0, 5);

    classList.forEach((student, sidx) => {
      const completed = (sidx + aidx) % 3 === 0;
      const progressId = `${assignment.id}-${student.id}-progress`;
      progress.push({
        id: progressId,
        assignmentId: assignment.id,
        studentId: student.id,
        status: completed ? "completed" : "pending",
        completedAt: completed ? iso(now) : null,
        score: assignment.submissionType === "quiz" && completed ? 4 : null,
        total: assignment.submissionType === "quiz" && completed ? 5 : null
      });

      if (!completed) return;

      if (assignment.submissionType === "quiz") {
        const answers = {};
        quizQuestions.forEach((q, qidx) => {
          answers[q.id] = qidx % 2 === 0 ? q.answer : "错误答案";
        });
        submissions.push({
          id: `${assignment.id}-${student.id}-sub`,
          assignmentId: assignment.id,
          studentId: student.id,
          answers,
          score: 4,
          total: 5,
          submittedAt: iso(now)
        });
        reviews.push({
          id: `${assignment.id}-${student.id}-review`,
          assignmentId: assignment.id,
          studentId: student.id,
          overallComment: "整体表现良好，注意错题复盘。",
          createdAt: iso(now),
          updatedAt: iso(now)
        });
        reviewItems.push({
          id: `${assignment.id}-${student.id}-review-item`,
          reviewId: `${assignment.id}-${student.id}-review`,
          questionId: quizQuestions[1]?.id ?? quizQuestions[0]?.id,
          wrongTag: "粗心",
          comment: "注意审题与计算步骤。"
        });
      } else {
        submissions.push({
          id: `${assignment.id}-${student.id}-sub`,
          assignmentId: assignment.id,
          studentId: student.id,
          answers: {},
          score: 0,
          total: 100,
          submittedAt: iso(now),
          submissionText: assignment.submissionType === "essay" ? "这是一篇示例作文内容。" : "上传作业已完成。"
        });
        if (assignment.submissionType === "upload") {
          uploads.push({
            id: `${assignment.id}-${student.id}-upload`,
            assignmentId: assignment.id,
            studentId: student.id,
            fileName: "作业.txt",
            mimeType: "text/plain",
            size: BASE64_TEXT.length,
            contentBase64: BASE64_TEXT,
            createdAt: iso(now)
          });
        }
        reviews.push({
          id: `${assignment.id}-${student.id}-review`,
          assignmentId: assignment.id,
          studentId: student.id,
          overallComment: "请继续保持，注意表达更完整。",
          createdAt: iso(now),
          updatedAt: iso(now)
        });
        const rubrics = assignmentRubrics.filter((rubric) => rubric.assignmentId === assignment.id);
        rubrics.forEach((rubric, ridx) => {
          reviewRubrics.push({
            id: `${assignment.id}-${student.id}-rubric-${ridx + 1}`,
            reviewId: `${assignment.id}-${student.id}-review`,
            rubricId: rubric.id,
            score: Math.max(6, rubric.maxScore - 2),
            comment: "表现不错，继续提升。"
          });
        });
      }
    });
  });

  return {
    classStudents,
    progress,
    submissions,
    uploads,
    reviews,
    reviewItems,
    reviewRubrics
  };
}

function buildAnnouncements(classes, teachers) {
  const announcements = [];
  classes.forEach((klass, idx) => {
    const teacher = teachers[idx % teachers.length];
    announcements.push({
      id: `${klass.id}-ann-1`,
      classId: klass.id,
      authorId: teacher.id,
      title: `${klass.name} 开学提醒`,
      content: "请按时完成本周作业，并准备课堂材料。",
      createdAt: daysAgo(2)
    });
    announcements.push({
      id: `${klass.id}-ann-2`,
      classId: klass.id,
      authorId: teacher.id,
      title: `${klass.name} 测试公告`,
      content: "本周五进行单元小测，请提前复习。",
      createdAt: daysAgo(1)
    });
  });
  return announcements;
}

function buildJoinRequests(classes, students) {
  const requests = [];
  classes.forEach((klass, idx) => {
    const student = students[idx % students.length];
    requests.push({
      id: `${klass.id}-join-${idx + 1}`,
      classId: klass.id,
      studentId: student.id,
      status: "pending",
      createdAt: iso(now)
    });
  });
  return requests;
}

function buildNotifications(students) {
  return students.slice(0, 5).map((student, idx) => ({
    id: `notice-bulk-${idx + 1}`,
    userId: student.id,
    title: "测试通知",
    content: "已生成批量测试数据，请开始体验。",
    type: "info",
    createdAt: iso(now)
  }));
}

async function seedJson() {
  const { teachers, students, parents } = buildUsers();
  const profiles = buildStudentProfiles(students);
  const classes = buildClasses(teachers);
  const { modules, resources } = buildModules(classes);
  const modulesByClass = new Map();
  modules.forEach((module) => {
    if (!modulesByClass.has(module.classId)) modulesByClass.set(module.classId, []);
    modulesByClass.get(module.classId).push(module);
  });
  const knowledgePoints = buildKnowledgePoints();
  const questions = buildQuestions(knowledgePoints);
  const questionsByKey = new Map();
  questions.forEach((q) => {
    const key = `${q.subject}-${q.grade}`;
    if (!questionsByKey.has(key)) questionsByKey.set(key, []);
    questionsByKey.get(key).push(q);
  });
  const { assignments, assignmentItems, assignmentRubrics } = buildAssignments(classes, questionsByKey, modulesByClass);
  const {
    classStudents,
    progress,
    submissions,
    uploads,
    reviews,
    reviewItems,
    reviewRubrics
  } = buildProgressAndSubmissions(classes, students, assignments, questionsByKey, assignmentRubrics);
  const announcements = buildAnnouncements(classes, teachers);
  const joinRequests = buildJoinRequests(classes, students);
  const notifications = buildNotifications(students);

  const users = readJson("users.json", []);
  [...teachers, ...students, ...parents].forEach((user) => {
    upsert(users, (item) => item.email === user.email, user);
  });
  writeJson("users.json", users);

  const studentProfiles = readJson("student-profiles.json", []);
  profiles.forEach((profile) => {
    upsert(studentProfiles, (item) => item.userId === profile.userId, profile);
  });
  writeJson("student-profiles.json", studentProfiles);

  const kpList = readJson("knowledge-points.json", []);
  knowledgePoints.forEach((kp) => upsert(kpList, (item) => item.id === kp.id, kp));
  writeJson("knowledge-points.json", kpList);

  const questionList = readJson("questions.json", []);
  questions.forEach((q) => upsert(questionList, (item) => item.id === q.id, q));
  writeJson("questions.json", questionList);

  const classList = readJson("classes.json", []);
  classes.forEach((klass) => upsert(classList, (item) => item.id === klass.id, klass));
  writeJson("classes.json", classList);

  const moduleList = readJson("course-modules.json", []);
  modules.forEach((mod) => upsert(moduleList, (item) => item.id === mod.id, mod));
  writeJson("course-modules.json", moduleList);

  const resourceList = readJson("module-resources.json", []);
  resources.forEach((res) => upsert(resourceList, (item) => item.id === res.id, res));
  writeJson("module-resources.json", resourceList);

  const classStudentList = readJson("class-students.json", []);
  classStudents.forEach((cs) => upsert(classStudentList, (item) => item.classId === cs.classId && item.studentId === cs.studentId, cs));
  writeJson("class-students.json", classStudentList);

  const joinList = readJson("class-join-requests.json", []);
  joinRequests.forEach((req) => upsert(joinList, (item) => item.classId === req.classId && item.studentId === req.studentId, req));
  writeJson("class-join-requests.json", joinList);

  const assignList = readJson("assignments.json", []);
  assignments.forEach((a) => upsert(assignList, (item) => item.id === a.id, a));
  writeJson("assignments.json", assignList);

  const itemList = readJson("assignment-items.json", []);
  const filteredItems = itemList.filter((item) => !assignmentItems.some((i) => i.assignmentId === item.assignmentId));
  writeJson("assignment-items.json", [...filteredItems, ...assignmentItems]);

  const progressList = readJson("assignment-progress.json", []);
  progress.forEach((p) => upsert(progressList, (item) => item.assignmentId === p.assignmentId && item.studentId === p.studentId, p));
  writeJson("assignment-progress.json", progressList);

  const submissionList = readJson("assignment-submissions.json", []);
  submissions.forEach((s) => upsert(submissionList, (item) => item.assignmentId === s.assignmentId && item.studentId === s.studentId, s));
  writeJson("assignment-submissions.json", submissionList);

  const uploadList = readJson("assignment-uploads.json", []);
  uploads.forEach((u) => upsert(uploadList, (item) => item.id === u.id, u));
  writeJson("assignment-uploads.json", uploadList);

  const reviewList = readJson("assignment-reviews.json", []);
  reviews.forEach((r) => upsert(reviewList, (item) => item.assignmentId === r.assignmentId && item.studentId === r.studentId, r));
  writeJson("assignment-reviews.json", reviewList);

  const reviewItemList = readJson("assignment-review-items.json", []);
  reviewItems.forEach((ri) => upsert(reviewItemList, (item) => item.id === ri.id, ri));
  writeJson("assignment-review-items.json", reviewItemList);

  const rubricList = readJson("assignment-rubrics.json", []);
  assignmentRubrics.forEach((r) => upsert(rubricList, (item) => item.id === r.id, r));
  writeJson("assignment-rubrics.json", rubricList);

  const reviewRubricList = readJson("assignment-review-rubrics.json", []);
  reviewRubrics.forEach((r) => upsert(reviewRubricList, (item) => item.id === r.id, r));
  writeJson("assignment-review-rubrics.json", reviewRubricList);

  const announcementList = readJson("announcements.json", []);
  announcements.forEach((a) => upsert(announcementList, (item) => item.id === a.id, a));
  writeJson("announcements.json", announcementList);

  const notifyList = readJson("notifications.json", []);
  notifications.forEach((n) => upsert(notifyList, (item) => item.id === n.id, n));
  writeJson("notifications.json", notifyList);

  console.log("批量测试数据（JSON/runtime 模式）已生成。");
  printSummary({ teachers, students, parents, classes });
}

async function ensureUser(client, user) {
  const result = await client.query(
    `INSERT INTO users (id, email, name, role, password, grade, school_id, student_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       password = EXCLUDED.password,
       grade = EXCLUDED.grade,
       school_id = EXCLUDED.school_id,
       student_id = EXCLUDED.student_id
     RETURNING id`,
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
  return result.rows[0].id;
}

async function seedDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  const client = await pool.connect();

  const { teachers, students, parents } = buildUsers();
  const updatedTeachers = [];
  const updatedStudents = [];
  const updatedParents = [];

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO schools (id, name, code, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', now(), now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         status = EXCLUDED.status,
         updated_at = now()`,
      [DEFAULT_SCHOOL_ID, DEFAULT_SCHOOL_NAME, DEFAULT_SCHOOL_CODE]
    );

    for (const teacher of teachers) {
      const id = await ensureUser(client, teacher);
      updatedTeachers.push({ ...teacher, id });
    }
    for (const student of students) {
      const id = await ensureUser(client, student);
      updatedStudents.push({ ...student, id });
    }

    const parentsLinked = parents.map((parent, idx) => ({
      ...parent,
      studentId: updatedStudents[idx]?.id ?? parent.studentId
    }));
    for (const parent of parentsLinked) {
      const id = await ensureUser(client, parent);
      updatedParents.push({ ...parent, id });
    }

    const profiles = buildStudentProfiles(updatedStudents);
    const classes = buildClasses(updatedTeachers);
    const { modules, resources } = buildModules(classes);
    const modulesByClass = new Map();
    modules.forEach((module) => {
      if (!modulesByClass.has(module.classId)) modulesByClass.set(module.classId, []);
      modulesByClass.get(module.classId).push(module);
    });
    const knowledgePoints = buildKnowledgePoints();
    const questions = buildQuestions(knowledgePoints);
    const questionsByKey = new Map();
    questions.forEach((q) => {
      const key = `${q.subject}-${q.grade}`;
      if (!questionsByKey.has(key)) questionsByKey.set(key, []);
      questionsByKey.get(key).push(q);
    });
    const { assignments, assignmentItems, assignmentRubrics } = buildAssignments(classes, questionsByKey, modulesByClass);
    const {
      classStudents,
      progress,
      submissions,
      uploads,
      reviews,
      reviewItems,
      reviewRubrics
    } = buildProgressAndSubmissions(classes, updatedStudents, assignments, questionsByKey, assignmentRubrics);
    const announcements = buildAnnouncements(classes, updatedTeachers);
    const joinRequests = buildJoinRequests(classes, updatedStudents);
    const notifications = buildNotifications(updatedStudents);

    for (const profile of profiles) {
      await client.query(
        `INSERT INTO student_profiles (id, user_id, grade, subjects, target, school, observer_code, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           grade = EXCLUDED.grade,
           subjects = EXCLUDED.subjects,
           target = EXCLUDED.target,
           school = EXCLUDED.school,
           observer_code = COALESCE(student_profiles.observer_code, EXCLUDED.observer_code),
           updated_at = EXCLUDED.updated_at`,
        [
          profile.id,
          profile.userId,
          profile.grade,
          profile.subjects,
          profile.target ?? "",
          profile.school ?? "",
          profile.observerCode ?? null,
          profile.updatedAt
        ]
      );
    }

    for (const kp of knowledgePoints) {
      await client.query(
        `INSERT INTO knowledge_points (id, subject, grade, title, chapter, unit)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           subject = EXCLUDED.subject,
           grade = EXCLUDED.grade,
           title = EXCLUDED.title,
           chapter = EXCLUDED.chapter,
           unit = EXCLUDED.unit`,
        [kp.id, kp.subject, kp.grade, kp.title, kp.chapter, kp.unit ?? "未分单元"]
      );
    }

    for (const question of questions) {
      await client.query(
        `INSERT INTO questions (id, subject, grade, knowledge_point_id, stem, options, answer, explanation, difficulty, question_type, tags, abilities)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           subject = EXCLUDED.subject,
           grade = EXCLUDED.grade,
           knowledge_point_id = EXCLUDED.knowledge_point_id,
           stem = EXCLUDED.stem,
           options = EXCLUDED.options,
           answer = EXCLUDED.answer,
           explanation = EXCLUDED.explanation,
           difficulty = EXCLUDED.difficulty,
           question_type = EXCLUDED.question_type,
           tags = EXCLUDED.tags,
           abilities = EXCLUDED.abilities`,
        [
          question.id,
          question.subject,
          question.grade,
          question.knowledgePointId,
          question.stem,
          question.options,
          question.answer,
          question.explanation,
          question.difficulty ?? "medium",
          question.questionType ?? "choice",
          question.tags ?? [],
          question.abilities ?? []
        ]
      );
    }

    for (const klass of classes) {
      await client.query(
        `INSERT INTO classes (id, name, subject, grade, school_id, teacher_id, created_at, join_code, join_mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           subject = EXCLUDED.subject,
           grade = EXCLUDED.grade,
           school_id = EXCLUDED.school_id,
           teacher_id = EXCLUDED.teacher_id,
           join_code = EXCLUDED.join_code,
           join_mode = EXCLUDED.join_mode`,
        [
          klass.id,
          klass.name,
          klass.subject,
          klass.grade,
          klass.schoolId ?? DEFAULT_SCHOOL_ID,
          klass.teacherId,
          klass.createdAt,
          klass.joinCode,
          klass.joinMode
        ]
      );
    }

    for (const cs of classStudents) {
      await client.query(
        `INSERT INTO class_students (id, class_id, student_id, joined_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (class_id, student_id) DO UPDATE SET joined_at = EXCLUDED.joined_at`,
        [cs.id, cs.classId, cs.studentId, cs.joinedAt]
      );
    }

    for (const req of joinRequests) {
      await client.query(
        `INSERT INTO class_join_requests (id, class_id, student_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (class_id, student_id) DO UPDATE SET
           status = EXCLUDED.status,
           created_at = EXCLUDED.created_at`,
        [req.id, req.classId, req.studentId, req.status, req.createdAt]
      );
    }

    for (const module of modules) {
      await client.query(
        `INSERT INTO course_modules (id, class_id, parent_id, title, description, order_index, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          module.id,
          module.classId,
          module.parentId ?? null,
          module.title,
          module.description ?? null,
          module.orderIndex ?? 0,
          module.createdAt
        ]
      );
    }

    for (const resource of resources) {
      await client.query(
        `INSERT INTO module_resources (id, module_id, title, resource_type, file_name, mime_type, size, content_base64, link_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          resource.id,
          resource.moduleId,
          resource.title,
          resource.resourceType,
          resource.fileName ?? null,
          resource.mimeType ?? null,
          resource.size ?? null,
          resource.contentBase64 ?? null,
          resource.linkUrl ?? null,
          resource.createdAt
        ]
      );
    }

    for (const assignment of assignments) {
      await client.query(
        `INSERT INTO assignments (id, class_id, module_id, title, description, due_date, created_at, submission_type, max_uploads, grading_focus)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           due_date = EXCLUDED.due_date,
           module_id = EXCLUDED.module_id,
           submission_type = EXCLUDED.submission_type,
           max_uploads = EXCLUDED.max_uploads,
           grading_focus = EXCLUDED.grading_focus`,
        [
          assignment.id,
          assignment.classId,
          assignment.moduleId ?? null,
          assignment.title,
          assignment.description,
          assignment.dueDate,
          assignment.createdAt,
          assignment.submissionType ?? "quiz",
          assignment.maxUploads ?? 3,
          assignment.gradingFocus ?? null
        ]
      );
    }

    for (const item of assignmentItems) {
      await client.query(
        `INSERT INTO assignment_items (id, assignment_id, question_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, item.assignmentId, item.questionId]
      );
    }

    for (const prog of progress) {
      await client.query(
        `INSERT INTO assignment_progress (id, assignment_id, student_id, status, completed_at, score, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET
           status = EXCLUDED.status,
           completed_at = EXCLUDED.completed_at,
           score = EXCLUDED.score,
           total = EXCLUDED.total`,
        [
          prog.id,
          prog.assignmentId,
          prog.studentId,
          prog.status,
          prog.completedAt,
          prog.score,
          prog.total
        ]
      );
    }

    for (const sub of submissions) {
      await client.query(
        `INSERT INTO assignment_submissions (id, assignment_id, student_id, answers, score, total, submitted_at, submission_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET
           answers = EXCLUDED.answers,
           score = EXCLUDED.score,
           total = EXCLUDED.total,
           submitted_at = EXCLUDED.submitted_at,
           submission_text = EXCLUDED.submission_text`,
        [
          sub.id,
          sub.assignmentId,
          sub.studentId,
          sub.answers,
          sub.score,
          sub.total,
          sub.submittedAt,
          sub.submissionText ?? null
        ]
      );
    }

    for (const upload of uploads) {
      await client.query(
        `INSERT INTO assignment_uploads (id, assignment_id, student_id, file_name, mime_type, size, content_base64, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          upload.id,
          upload.assignmentId,
          upload.studentId,
          upload.fileName,
          upload.mimeType,
          upload.size,
          upload.contentBase64,
          upload.createdAt
        ]
      );
    }

    for (const review of reviews) {
      await client.query(
        `INSERT INTO assignment_reviews (id, assignment_id, student_id, overall_comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET
           overall_comment = EXCLUDED.overall_comment,
           updated_at = EXCLUDED.updated_at`,
        [
          review.id,
          review.assignmentId,
          review.studentId,
          review.overallComment ?? null,
          review.createdAt,
          review.updatedAt
        ]
      );
    }

    for (const item of reviewItems) {
      await client.query(
        `INSERT INTO assignment_review_items (id, review_id, question_id, wrong_tag, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, item.reviewId, item.questionId, item.wrongTag ?? null, item.comment ?? null]
      );
    }

    for (const rubric of assignmentRubrics) {
      await client.query(
        `INSERT INTO assignment_rubrics (id, assignment_id, title, description, max_score, weight, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          rubric.id,
          rubric.assignmentId,
          rubric.title,
          rubric.description ?? null,
          rubric.maxScore,
          rubric.weight,
          rubric.createdAt
        ]
      );
    }

    for (const rr of reviewRubrics) {
      await client.query(
        `INSERT INTO assignment_review_rubrics (id, review_id, rubric_id, score, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [rr.id, rr.reviewId, rr.rubricId, rr.score, rr.comment ?? null]
      );
    }

    for (const ann of announcements) {
      await client.query(
        `INSERT INTO announcements (id, class_id, author_id, title, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [ann.id, ann.classId, ann.authorId ?? null, ann.title, ann.content, ann.createdAt]
      );
    }

    for (const notice of notifications) {
      await client.query(
        `INSERT INTO notifications (id, user_id, title, content, type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [notice.id, notice.userId, notice.title, notice.content, notice.type, notice.createdAt]
      );
    }

    await client.query("COMMIT");
    console.log("批量测试数据（DB 模式）已生成。");
    printSummary({ teachers: updatedTeachers, students: updatedStudents, parents: updatedParents, classes });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

function printSummary({ teachers, students, parents, classes }) {
  console.log("");
  console.log("账号示例：");
  console.log(`教师：${teachers[0]?.email} / Teacher123`);
  console.log(`学生：${students[0]?.email} / Student123`);
  console.log(`家长：${parents[0]?.email} / Parent123`);
  console.log("");
  console.log("班级示例：");
  classes.slice(0, 3).forEach((klass) => {
    console.log(`- ${klass.name} (${klass.subject}, ${klass.grade}年级) 邀请码: ${klass.joinCode}`);
  });
}

if (process.env.DATABASE_URL) {
  await seedDb();
} else {
  await seedJson();
}
