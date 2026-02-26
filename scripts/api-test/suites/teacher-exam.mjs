import assert from "node:assert/strict";

export async function runTeacherExamSuite(context) {
  const { apiFetch, state } = context;
  const { email, password } = state;

  const teacherCandidates = [
    {
      email: process.env.API_TEST_TEACHER_EMAIL || "teacher@demo.com",
      password: process.env.API_TEST_TEACHER_PASSWORD || "Teacher123"
    },
    {
      email: process.env.API_TEST_TEACHER_FALLBACK_EMAIL || "teacher1@demo.com",
      password: process.env.API_TEST_TEACHER_FALLBACK_PASSWORD || "Teacher123"
    }
  ];
  let teacherLogin = null;
  for (const candidate of teacherCandidates) {
    const resp = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: candidate.email, password: candidate.password, role: "teacher" }
    });
    if (resp.status === 200) {
      teacherLogin = resp;
      break;
    }
  }
  assert.equal(teacherLogin?.status, 200, "Teacher login failed for both primary and fallback accounts");

  const teacherInsights = await apiFetch("/api/teacher/insights");
  assert.equal(teacherInsights.status, 200, `GET /api/teacher/insights failed: ${teacherInsights.raw}`);
  assert.equal(
    typeof teacherInsights.body?.summary?.classRiskScore,
    "number",
    "Teacher insights should include summary.classRiskScore"
  );
  assert.ok(Array.isArray(teacherInsights.body?.alerts), "Teacher insights should include alerts");

  const teacherAlerts = await apiFetch("/api/teacher/alerts");
  assert.equal(teacherAlerts.status, 200, `GET /api/teacher/alerts failed: ${teacherAlerts.raw}`);
  assert.ok(Array.isArray(teacherAlerts.body?.data?.alerts), "Teacher alerts should include alerts");
  const firstAlertId = teacherAlerts.body?.data?.alerts?.[0]?.id;
  if (firstAlertId) {
    const ackAlert = await apiFetch(`/api/teacher/alerts/${firstAlertId}/ack`, {
      method: "POST",
      json: {}
    });
    assert.equal(ackAlert.status, 200, `POST /api/teacher/alerts/[id]/ack failed: ${ackAlert.raw}`);
    assert.equal(ackAlert.body?.data?.status, "acknowledged");
  }

  const teacherClasses = await apiFetch("/api/teacher/classes");
  assert.equal(teacherClasses.status, 200, `GET /api/teacher/classes failed: ${teacherClasses.raw}`);
  const teacherClassList = teacherClasses.body?.data ?? [];
  let examClass = teacherClassList.find((item) => item.subject === "math" && item.grade === "4");

  if (!examClass) {
    const createExamClass = await apiFetch("/api/teacher/classes", {
      method: "POST",
      json: {
        name: `API_TEST_EXAM_CLASS_${Date.now().toString(36)}`,
        subject: "math",
        grade: "4"
      }
    });
    assert.equal(createExamClass.status, 200, `POST /api/teacher/classes failed: ${createExamClass.raw}`);
    examClass = createExamClass.body?.data;
  }

  assert.ok(examClass?.id, "Teacher exam class should have id");

  const addExamStudent = await apiFetch(`/api/teacher/classes/${examClass.id}/students`, {
    method: "POST",
    json: { email }
  });
  assert.equal(
    addExamStudent.status,
    200,
    `POST /api/teacher/classes/[id]/students failed: ${addExamStudent.raw}`
  );

  const examSuffix = Date.now().toString(36);
  const createExam = await apiFetch("/api/teacher/exams", {
    method: "POST",
    json: {
      classId: examClass.id,
      title: `API_TEST_EXAM_${examSuffix}`,
      endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      questionCount: 1,
      difficulty: "medium",
      questionType: "choice"
    }
  });
  assert.equal(createExam.status, 200, `POST /api/teacher/exams failed: ${createExam.raw}`);
  const createdExamId = createExam.body?.data?.id;
  assert.ok(createdExamId, "Create exam should return data.id");
  state.createdExamId = createdExamId;

  const teacherExamList = await apiFetch("/api/teacher/exams");
  assert.equal(teacherExamList.status, 200, `GET /api/teacher/exams failed: ${teacherExamList.raw}`);
  assert.ok(Array.isArray(teacherExamList.body?.data), "Teacher exams should include data array");
  const createdExamInList = (teacherExamList.body?.data ?? []).find((item) => item.id === createdExamId);
  assert.ok(createdExamInList, "Created exam should appear in teacher exam list");

  const teacherExamDetail = await apiFetch(`/api/teacher/exams/${createdExamId}`);
  assert.equal(teacherExamDetail.status, 200, `GET /api/teacher/exams/[id] failed: ${teacherExamDetail.raw}`);
  assert.ok(Array.isArray(teacherExamDetail.body?.students), "Teacher exam detail should include students");

  const teacherExamExport = await apiFetch(`/api/teacher/exams/${createdExamId}/export`);
  assert.equal(
    teacherExamExport.status,
    200,
    `GET /api/teacher/exams/[id]/export failed: ${teacherExamExport.raw}`
  );
  assert.ok(
    teacherExamExport.raw.includes("学生姓名"),
    "Teacher exam export should include CSV header 学生姓名"
  );

  const reloginStudent = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email, password, role: "student" }
  });
  assert.equal(reloginStudent.status, 200, `Student relogin failed: ${reloginStudent.raw}`);

  const studentExams = await apiFetch("/api/student/exams");
  assert.equal(studentExams.status, 200, `GET /api/student/exams failed: ${studentExams.raw}`);
  assert.ok(Array.isArray(studentExams.body?.data), "Student exams should include data array");
  const targetExam = (studentExams.body?.data ?? []).find((item) => item.id === createdExamId);
  assert.ok(targetExam, "Student exam list should include assigned exam");

  const studentExamDetail = await apiFetch(`/api/student/exams/${createdExamId}`);
  assert.equal(studentExamDetail.status, 200, `GET /api/student/exams/[id] failed: ${studentExamDetail.raw}`);
  assert.ok(Array.isArray(studentExamDetail.body?.questions), "Student exam detail should include questions");
  const firstExamQuestion = studentExamDetail.body?.questions?.[0];
  assert.ok(firstExamQuestion?.id, "Student exam detail should include at least one question");

  const examAnswer = firstExamQuestion.options?.[0] ?? "";
  const examAutosave = await apiFetch(`/api/student/exams/${createdExamId}/autosave`, {
    method: "POST",
    json: {
      answers: {
        [firstExamQuestion.id]: examAnswer
      }
    }
  });
  assert.equal(
    examAutosave.status,
    200,
    `POST /api/student/exams/[id]/autosave failed: ${examAutosave.raw}`
  );
  assert.equal(examAutosave.body?.status, "in_progress", "Exam autosave should switch status to in_progress");

  const examSubmit = await apiFetch(`/api/student/exams/${createdExamId}/submit`, {
    method: "POST",
    json: {
      answers: {
        [firstExamQuestion.id]: examAnswer
      }
    }
  });
  assert.equal(examSubmit.status, 200, `POST /api/student/exams/[id]/submit failed: ${examSubmit.raw}`);
  assert.equal(typeof examSubmit.body?.score, "number", "Exam submit should return score");
  assert.equal(typeof examSubmit.body?.total, "number", "Exam submit should return total");

  const studentExamsAfterSubmit = await apiFetch("/api/student/exams");
  assert.equal(
    studentExamsAfterSubmit.status,
    200,
    `GET /api/student/exams after submit failed: ${studentExamsAfterSubmit.raw}`
  );
  const submittedExam = (studentExamsAfterSubmit.body?.data ?? []).find((item) => item.id === createdExamId);
  assert.equal(submittedExam?.status, "submitted", "Student exam should be marked as submitted");
}
