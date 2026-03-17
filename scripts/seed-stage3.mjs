import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");

const SCHOOL_ID = "school-default";
const CLASS_A_ID = "class-stage3-a";
const CLASS_B_ID = "class-stage3-b";
const CLASS_C_ID = "class-stage3-c";
const ASSIGNMENT_ID = "assign-stage3-001";
const REVIEW_ID = "review-stage3-001";
const SUBMISSION_ID = "assign-sub-stage3-001";

const now = new Date();
const iso = (date) => new Date(date).toISOString();
const daysAgo = (n) => iso(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => iso(Date.now() + n * 24 * 60 * 60 * 1000);

const PRIMARY_TEACHER = {
  id: "u-teacher-001",
  email: "teacher@demo.com",
  name: "刘老师",
  role: "teacher",
  schoolId: SCHOOL_ID,
  password: "plain:Teacher123"
};

const SCHEDULE_TEACHER_2 = {
  id: "u-teacher-stage3-002",
  email: "teacher2@demo.com",
  name: "周老师",
  role: "teacher",
  schoolId: SCHOOL_ID,
  password: "plain:Teacher123"
};

const SCHEDULE_TEACHER_3 = {
  id: "u-teacher-stage3-003",
  email: "teacher3@demo.com",
  name: "吴老师",
  role: "teacher",
  schoolId: SCHOOL_ID,
  password: "plain:Teacher123"
};

const PRIMARY_STUDENT = {
  id: "u-student-001",
  email: "student@demo.com",
  name: "小星",
  role: "student",
  grade: "4",
  schoolId: SCHOOL_ID,
  password: "plain:Student123"
};

const SECOND_STUDENT = {
  id: "u-student-002",
  email: "student2@demo.com",
  name: "小芽",
  role: "student",
  grade: "4",
  schoolId: SCHOOL_ID,
  password: "plain:Student123"
};

const THIRD_STUDENT = {
  id: "u-student-003",
  email: "student3@demo.com",
  name: "小澄",
  role: "student",
  grade: "4",
  schoolId: SCHOOL_ID,
  password: "plain:Student123"
};

const PRIMARY_PARENT = {
  id: "u-parent-001",
  email: "parent@demo.com",
  name: "星妈",
  role: "parent",
  schoolId: SCHOOL_ID,
  studentId: PRIMARY_STUDENT.id,
  password: "plain:Parent123"
};

const usersSeed = [
  PRIMARY_TEACHER,
  SCHEDULE_TEACHER_2,
  SCHEDULE_TEACHER_3,
  PRIMARY_STUDENT,
  SECOND_STUDENT,
  THIRD_STUDENT,
  PRIMARY_PARENT
];

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

async function seedJson() {
  const users = readJson("users.json", []);
  usersSeed.forEach((user) => {
    const existing = users.find((u) => u.email === user.email);
    if (existing) {
      Object.assign(existing, user, { id: existing.id });
    } else {
      users.push(user);
    }
  });
  writeJson("users.json", users);

  const questions = readJson("questions.json", []);
  const mathQuestions = questions.filter((q) => q.subject === "math");
  const selectedQuestions = mathQuestions.slice(0, 3);
  if (selectedQuestions.length < 3) {
    console.log("题库数量不足，请先准备 3 道数学题。");
    return;
  }

  const teacher = users.find((u) => u.email === PRIMARY_TEACHER.email) ?? PRIMARY_TEACHER;
  const teacher2 = users.find((u) => u.email === SCHEDULE_TEACHER_2.email) ?? SCHEDULE_TEACHER_2;
  const teacher3 = users.find((u) => u.email === SCHEDULE_TEACHER_3.email) ?? SCHEDULE_TEACHER_3;
  const student = users.find((u) => u.email === PRIMARY_STUDENT.email) ?? PRIMARY_STUDENT;
  const student2 = users.find((u) => u.email === SECOND_STUDENT.email) ?? SECOND_STUDENT;
  const student3 = users.find((u) => u.email === THIRD_STUDENT.email) ?? THIRD_STUDENT;

  const classes = readJson("classes.json", []);
  upsert(
    classes,
    (item) => item.id === CLASS_A_ID,
    {
      id: CLASS_A_ID,
      name: "四年级一班",
      subject: "math",
      grade: "4",
      teacherId: teacher.id,
      schoolId: SCHOOL_ID,
      createdAt: daysAgo(2),
      joinCode: "JOINA",
      joinMode: "approval"
    }
  );
  upsert(
    classes,
    (item) => item.id === CLASS_B_ID,
    {
      id: CLASS_B_ID,
      name: "四年级二班",
      subject: "math",
      grade: "4",
      teacherId: teacher2.id,
      schoolId: SCHOOL_ID,
      createdAt: daysAgo(1),
      joinCode: "JOINB",
      joinMode: "auto"
    }
  );
  upsert(
    classes,
    (item) => item.id === CLASS_C_ID,
    {
      id: CLASS_C_ID,
      name: "四年级三班",
      subject: "math",
      grade: "4",
      teacherId: teacher3.id,
      schoolId: SCHOOL_ID,
      createdAt: iso(now),
      joinCode: "JOINC",
      joinMode: "approval"
    }
  );
  writeJson("classes.json", classes);

  const classStudents = readJson("class-students.json", []);
  upsert(
    classStudents,
    (item) => item.classId === CLASS_B_ID && item.studentId === student.id,
    {
      id: "class-student-stage3-001",
      classId: CLASS_B_ID,
      studentId: student.id,
      joinedAt: iso(now)
    }
  );
  upsert(
    classStudents,
    (item) => item.classId === CLASS_B_ID && item.studentId === student2.id,
    {
      id: "class-student-stage3-002",
      classId: CLASS_B_ID,
      studentId: student2.id,
      joinedAt: iso(now)
    }
  );
  upsert(
    classStudents,
    (item) => item.classId === CLASS_B_ID && item.studentId === student3.id,
    {
      id: "class-student-stage3-003",
      classId: CLASS_B_ID,
      studentId: student3.id,
      joinedAt: iso(now)
    }
  );
  writeJson("class-students.json", classStudents);

  const joinRequests = readJson("class-join-requests.json", []);
  upsert(
    joinRequests,
    (item) => item.classId === CLASS_A_ID && item.studentId === student.id,
    {
      id: "join-stage3-001",
      classId: CLASS_A_ID,
      studentId: student.id,
      status: "pending",
      createdAt: iso(now)
    }
  );
  writeJson("class-join-requests.json", joinRequests);

  const assignments = readJson("assignments.json", []);
  upsert(
    assignments,
    (item) => item.id === ASSIGNMENT_ID,
    {
      id: ASSIGNMENT_ID,
      classId: CLASS_B_ID,
      title: "阶段三测试作业",
      description: "用于测试批改与复盘流程。",
      dueDate: daysAhead(3),
      createdAt: iso(now)
    }
  );
  writeJson("assignments.json", assignments);

  const assignmentItems = readJson("assignment-items.json", []).filter((item) => item.assignmentId !== ASSIGNMENT_ID);
  selectedQuestions.forEach((q, index) => {
    assignmentItems.push({
      id: `assign-item-stage3-${index + 1}`,
      assignmentId: ASSIGNMENT_ID,
      questionId: q.id
    });
  });
  writeJson("assignment-items.json", assignmentItems);

  const assignmentProgress = readJson("assignment-progress.json", []);
  upsert(
    assignmentProgress,
    (item) => item.assignmentId === ASSIGNMENT_ID && item.studentId === student.id,
    {
      id: "assign-progress-stage3-001",
      assignmentId: ASSIGNMENT_ID,
      studentId: student.id,
      status: "completed",
      completedAt: iso(now),
      score: 2,
      total: 3
    }
  );
  upsert(
    assignmentProgress,
    (item) => item.assignmentId === ASSIGNMENT_ID && item.studentId === student2.id,
    {
      id: "assign-progress-stage3-002",
      assignmentId: ASSIGNMENT_ID,
      studentId: student2.id,
      status: "pending"
    }
  );
  upsert(
    assignmentProgress,
    (item) => item.assignmentId === ASSIGNMENT_ID && item.studentId === student3.id,
    {
      id: "assign-progress-stage3-003",
      assignmentId: ASSIGNMENT_ID,
      studentId: student3.id,
      status: "pending"
    }
  );
  writeJson("assignment-progress.json", assignmentProgress);

  const answers = {
    [selectedQuestions[0].id]: selectedQuestions[0].answer,
    [selectedQuestions[1].id]: "错误答案",
    [selectedQuestions[2].id]: selectedQuestions[2].answer
  };

  const submissions = readJson("assignment-submissions.json", []);
  upsert(
    submissions,
    (item) => item.assignmentId === ASSIGNMENT_ID && item.studentId === student.id,
    {
      id: SUBMISSION_ID,
      assignmentId: ASSIGNMENT_ID,
      studentId: student.id,
      answers,
      score: 2,
      total: 3,
      submittedAt: iso(now)
    }
  );
  writeJson("assignment-submissions.json", submissions);

  const reviews = readJson("assignment-reviews.json", []);
  upsert(
    reviews,
    (item) => item.assignmentId === ASSIGNMENT_ID && item.studentId === student.id,
    {
      id: REVIEW_ID,
      assignmentId: ASSIGNMENT_ID,
      studentId: student.id,
      overallComment: "整体掌握不错，注意概念表述。",
      createdAt: iso(now),
      updatedAt: iso(now)
    }
  );
  writeJson("assignment-reviews.json", reviews);

  const reviewItems = readJson("assignment-review-items.json", []).filter((item) => item.reviewId !== REVIEW_ID);
  reviewItems.push({
    id: "review-item-stage3-001",
    reviewId: REVIEW_ID,
    questionId: selectedQuestions[1].id,
    wrongTag: "概念混淆",
    comment: "注意分数含义，复习基本概念。"
  });
  writeJson("assignment-review-items.json", reviewItems);

  const attempts = readJson("question-attempts.json", []);
  const attemptSeed = selectedQuestions.map((q, index) => ({
    id: `attempt-stage3-00${index + 1}`,
    userId: student.id,
    questionId: q.id,
    subject: q.subject,
    knowledgePointId: q.knowledgePointId,
    correct: index !== 1,
    answer: index === 1 ? "错误答案" : q.answer,
    createdAt: index === 2 ? daysAgo(10) : daysAgo(index + 1)
  }));
  attemptSeed.forEach((att) => upsert(attempts, (item) => item.id === att.id, att));
  writeJson("question-attempts.json", attempts);

  const notifications = readJson("notifications.json", []);
  upsert(
    notifications,
    (item) => item.id === "notice-stage3-001",
    {
      id: "notice-stage3-001",
      userId: student.id,
      title: "阶段三测试通知",
      content: "已生成阶段三测试数据，请查看作业与复盘。",
      type: "info",
      createdAt: iso(now)
    }
  );
  writeJson("notifications.json", notifications);

  console.log("Stage3 测试数据（JSON/runtime 模式）已生成。");
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

  try {
    await client.query("BEGIN");

    const teacherId = await ensureUser(client, PRIMARY_TEACHER);
    const teacher2Id = await ensureUser(client, SCHEDULE_TEACHER_2);
    const teacher3Id = await ensureUser(client, SCHEDULE_TEACHER_3);
    const studentId = await ensureUser(client, PRIMARY_STUDENT);
    const student2Id = await ensureUser(client, SECOND_STUDENT);
    const student3Id = await ensureUser(client, THIRD_STUDENT);
    await ensureUser(client, { ...PRIMARY_PARENT, studentId });

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
      [CLASS_A_ID, "四年级一班", "math", "4", SCHOOL_ID, teacherId, daysAgo(2), "JOINA", "approval"]
    );

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
      [CLASS_B_ID, "四年级二班", "math", "4", SCHOOL_ID, teacher2Id, daysAgo(1), "JOINB", "auto"]
    );

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
      [CLASS_C_ID, "四年级三班", "math", "4", SCHOOL_ID, teacher3Id, iso(now), "JOINC", "approval"]
    );

    await client.query(
      `INSERT INTO class_students (id, class_id, student_id, joined_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, student_id) DO UPDATE SET joined_at = EXCLUDED.joined_at`,
      ["class-student-stage3-001", CLASS_B_ID, studentId, iso(now)]
    );
    await client.query(
      `INSERT INTO class_students (id, class_id, student_id, joined_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, student_id) DO UPDATE SET joined_at = EXCLUDED.joined_at`,
      ["class-student-stage3-002", CLASS_B_ID, student2Id, iso(now)]
    );
    await client.query(
      `INSERT INTO class_students (id, class_id, student_id, joined_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, student_id) DO UPDATE SET joined_at = EXCLUDED.joined_at`,
      ["class-student-stage3-003", CLASS_B_ID, student3Id, iso(now)]
    );

    await client.query(
      `INSERT INTO class_join_requests (id, class_id, student_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (class_id, student_id) DO UPDATE SET
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at`,
      ["join-stage3-001", CLASS_A_ID, studentId, "pending", iso(now)]
    );

    await client.query(
      `INSERT INTO assignments (id, class_id, title, description, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         due_date = EXCLUDED.due_date`,
      [ASSIGNMENT_ID, CLASS_B_ID, "阶段三测试作业", "用于测试批改与复盘流程。", daysAhead(3), iso(now)]
    );

    const knowledgePoints = readJson("knowledge-points.json", []);
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

    const questions = readJson("questions.json", []);
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
          question.explanation ?? "",
          question.difficulty ?? "medium",
          question.questionType ?? "choice",
          question.tags ?? [],
          question.abilities ?? []
        ]
      );
    }

    const selectedQuestions = questions.filter((q) => q.subject === "math").slice(0, 3);
    if (selectedQuestions.length < 3) {
      throw new Error("题库数量不足，请先准备 3 道数学题。");
    }

    await client.query("DELETE FROM assignment_items WHERE assignment_id = $1", [ASSIGNMENT_ID]);
    for (let i = 0; i < selectedQuestions.length; i += 1) {
      await client.query(
        `INSERT INTO assignment_items (id, assignment_id, question_id)
         VALUES ($1, $2, $3)`,
        [`assign-item-stage3-${i + 1}`, ASSIGNMENT_ID, selectedQuestions[i].id]
      );
    }

    await client.query("DELETE FROM assignment_progress WHERE assignment_id = $1 AND student_id = $2", [
      ASSIGNMENT_ID,
      studentId
    ]);
    await client.query(
      `INSERT INTO assignment_progress (id, assignment_id, student_id, status, completed_at, score, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["assign-progress-stage3-001", ASSIGNMENT_ID, studentId, "completed", iso(now), 2, 3]
    );
    await client.query(
      `INSERT INTO assignment_progress (id, assignment_id, student_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET status = EXCLUDED.status`,
      ["assign-progress-stage3-002", ASSIGNMENT_ID, student2Id, "pending"]
    );
    await client.query(
      `INSERT INTO assignment_progress (id, assignment_id, student_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET status = EXCLUDED.status`,
      ["assign-progress-stage3-003", ASSIGNMENT_ID, student3Id, "pending"]
    );

    const answers = {
      [selectedQuestions[0].id]: selectedQuestions[0].answer,
      [selectedQuestions[1].id]: "错误答案",
      [selectedQuestions[2].id]: selectedQuestions[2].answer
    };

    await client.query(
      `INSERT INTO assignment_submissions (id, assignment_id, student_id, answers, score, total, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         score = EXCLUDED.score,
         total = EXCLUDED.total,
         submitted_at = EXCLUDED.submitted_at`,
      [SUBMISSION_ID, ASSIGNMENT_ID, studentId, answers, 2, 3, iso(now)]
    );

    await client.query(
      `INSERT INTO assignment_reviews (id, assignment_id, student_id, overall_comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET
         overall_comment = EXCLUDED.overall_comment,
         updated_at = EXCLUDED.updated_at`,
      [REVIEW_ID, ASSIGNMENT_ID, studentId, "整体掌握不错，注意概念表述。", iso(now), iso(now)]
    );

    await client.query("DELETE FROM assignment_review_items WHERE review_id = $1", [REVIEW_ID]);
    await client.query(
      `INSERT INTO assignment_review_items (id, review_id, question_id, wrong_tag, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "review-item-stage3-001",
        REVIEW_ID,
        selectedQuestions[1].id,
        "概念混淆",
        "注意分数含义，复习基本概念。"
      ]
    );

    const attempts = selectedQuestions.map((q, index) => ({
      id: `attempt-stage3-00${index + 1}`,
      userId: studentId,
      questionId: q.id,
      subject: q.subject,
      knowledgePointId: q.knowledgePointId,
      correct: index !== 1,
      answer: index === 1 ? "错误答案" : q.answer,
      createdAt: index === 2 ? daysAgo(10) : daysAgo(index + 1)
    }));

    for (const att of attempts) {
      await client.query(
        `INSERT INTO question_attempts
         (id, user_id, question_id, subject, knowledge_point_id, correct, answer, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           correct = EXCLUDED.correct,
           answer = EXCLUDED.answer,
           created_at = EXCLUDED.created_at`,
        [
          att.id,
          att.userId,
          att.questionId,
          att.subject,
          att.knowledgePointId,
          att.correct,
          att.answer,
          null,
          att.createdAt
        ]
      );
    }

    await client.query(
      `INSERT INTO notifications (id, user_id, title, content, type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         type = EXCLUDED.type,
         created_at = EXCLUDED.created_at`,
      ["notice-stage3-001", studentId, "阶段三测试通知", "已生成阶段三测试数据，请查看作业与复盘。", "info", iso(now)]
    );

    await client.query("COMMIT");
    console.log("Stage3 测试数据（DB 模式）已生成。");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.env.DATABASE_URL) {
  await seedDb();
} else {
  await seedJson();
}
