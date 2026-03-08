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

  const teacherDashboardOverview = await apiFetch("/api/dashboard/overview");
  assert.equal(teacherDashboardOverview.status, 200, `Teacher GET /api/dashboard/overview failed: ${teacherDashboardOverview.raw}`);
  assert.equal(teacherDashboardOverview.body?.data?.role, "teacher", "Teacher dashboard overview should detect teacher role");
  assert.ok(Array.isArray(teacherDashboardOverview.body?.data?.alerts), "Teacher dashboard overview should include alerts");

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

  const generatePaper = await apiFetch("/api/teacher/paper/generate", {
    method: "POST",
    json: {
      classId: examClass.id,
      questionCount: 8,
      mode: "ai",
      difficulty: "hard",
      questionType: "application",
      knowledgePointIds: ["API_TEST_NON_EXISTING_KP"]
    }
  });
  assert.equal(generatePaper.status, 200, `POST /api/teacher/paper/generate failed: ${generatePaper.raw}`);
  assert.ok((generatePaper.body?.data?.count ?? 0) >= 1, "Paper generate should return at least 1 question");
  assert.equal(
    typeof generatePaper.body?.data?.diagnostics?.selectedStage,
    "string",
    "Paper generate should return diagnostics.selectedStage"
  );
  assert.equal(
    typeof generatePaper.body?.data?.qualityGovernance?.activePoolCount,
    "number",
    "Paper generate should return qualityGovernance.activePoolCount"
  );

  const addExamStudent = await apiFetch(`/api/teacher/classes/${examClass.id}/students`, {
    method: "POST",
    json: { email }
  });
  assert.equal(
    addExamStudent.status,
    200,
    `POST /api/teacher/classes/[id]/students failed: ${addExamStudent.raw}`
  );

  const classStudents = await apiFetch(`/api/teacher/classes/${examClass.id}/students`);
  assert.equal(
    classStudents.status,
    200,
    `GET /api/teacher/classes/[id]/students failed: ${classStudents.raw}`
  );
  const targetStudent = (classStudents.body?.data ?? []).find((item) => item.email === email);
  assert.ok(targetStudent?.id, "Target student should exist in class roster");

  const submissionAssignment = await apiFetch("/api/teacher/assignments", {
    method: "POST",
    json: {
      classId: examClass.id,
      title: `API_TEST_SUBMISSION_${Date.now().toString(36)}`,
      description: "API 测试上传作业",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      submissionType: "upload",
      maxUploads: 2
    }
  });
  assert.equal(
    submissionAssignment.status,
    200,
    `POST /api/teacher/assignments upload failed: ${submissionAssignment.raw}`
  );
  const submissionAssignmentId = submissionAssignment.body?.data?.id;
  assert.ok(submissionAssignmentId, "Teacher upload assignment should return data.id");

  const teacherInboxThreadSubject = `API_TEST_THREAD_${Date.now().toString(36)}`;
  const teacherInboxThread = await apiFetch("/api/inbox/threads", {
    method: "POST",
    json: {
      classId: examClass.id,
      subject: teacherInboxThreadSubject,
      content: "这是一条给班级学生的 API 测试站内信。"
    }
  });
  assert.equal(teacherInboxThread.status, 200, `POST /api/inbox/threads failed: ${teacherInboxThread.raw}`);
  const teacherInboxThreadId = teacherInboxThread.body?.data?.threadId;
  assert.ok(teacherInboxThreadId, "Teacher inbox thread should return threadId");

  const teacherInboxThreads = await apiFetch("/api/inbox/threads");
  assert.equal(teacherInboxThreads.status, 200, `Teacher GET /api/inbox/threads failed: ${teacherInboxThreads.raw}`);
  const createdTeacherThread = (teacherInboxThreads.body?.data ?? []).find((item) => item.id === teacherInboxThreadId);
  assert.ok(createdTeacherThread, "Teacher inbox thread should appear in thread list");
  assert.equal(createdTeacherThread?.subject, teacherInboxThreadSubject);

  const savedNotificationRule = await apiFetch("/api/teacher/notifications/rules", {
    method: "POST",
    json: {
      classId: examClass.id,
      enabled: true,
      dueDays: 3,
      overdueDays: 1,
      includeParents: false
    }
  });
  assert.equal(
    savedNotificationRule.status,
    200,
    `POST /api/teacher/notifications/rules failed: ${savedNotificationRule.raw}`
  );
  assert.equal(savedNotificationRule.body?.data?.classId, examClass.id);
  assert.equal(savedNotificationRule.body?.data?.dueDays, 3);
  assert.equal(savedNotificationRule.body?.data?.includeParents, false);

  const teacherNotificationRules = await apiFetch("/api/teacher/notifications/rules");
  assert.equal(
    teacherNotificationRules.status,
    200,
    `GET /api/teacher/notifications/rules failed: ${teacherNotificationRules.raw}`
  );
  const fetchedNotificationRule = (teacherNotificationRules.body?.rules ?? []).find((item) => item.classId === examClass.id);
  assert.ok(fetchedNotificationRule, "Teacher notification rules should include saved class rule");
  assert.equal(fetchedNotificationRule?.dueDays, 3);
  assert.equal(fetchedNotificationRule?.includeParents, false);

  const teacherNotificationPreview = await apiFetch("/api/teacher/notifications/preview", {
    method: "POST",
    json: {
      classId: examClass.id,
      enabled: true,
      dueDays: 3,
      overdueDays: 1,
      includeParents: false
    }
  });
  assert.equal(
    teacherNotificationPreview.status,
    200,
    `POST /api/teacher/notifications/preview failed: ${teacherNotificationPreview.raw}`
  );
  assert.equal(teacherNotificationPreview.body?.data?.class?.id, examClass.id);
  assert.equal(teacherNotificationPreview.body?.data?.rule?.includeParents, false);
  assert.ok(
    (teacherNotificationPreview.body?.data?.summary?.studentTargets ?? 0) >= 1,
    "Teacher notification preview should target at least one student"
  );
  assert.equal(
    teacherNotificationPreview.body?.data?.summary?.parentTargets,
    0,
    "Teacher notification preview should suppress parent targets when includeParents is false"
  );
  assert.ok(
    (teacherNotificationPreview.body?.data?.sampleAssignments ?? []).some((item) => item.assignmentId === submissionAssignmentId),
    "Teacher notification preview should include the created upload assignment"
  );

  const teacherNotificationRun = await apiFetch("/api/teacher/notifications/run", {
    method: "POST",
    json: {
      classId: examClass.id,
      enabled: true,
      dueDays: 3,
      overdueDays: 1,
      includeParents: false
    }
  });
  assert.equal(
    teacherNotificationRun.status,
    200,
    `POST /api/teacher/notifications/run failed: ${teacherNotificationRun.raw}`
  );
  assert.ok(
    (teacherNotificationRun.body?.data?.students ?? 0) >= 1,
    "Teacher notification run should send at least one student reminder"
  );
  assert.equal(
    teacherNotificationRun.body?.data?.parents,
    0,
    "Teacher notification run should not send parent reminders when includeParents is false"
  );

  const teacherNotificationHistory = await apiFetch(`/api/teacher/notifications/history?classId=${examClass.id}&limit=5`);
  assert.equal(
    teacherNotificationHistory.status,
    200,
    `GET /api/teacher/notifications/history failed: ${teacherNotificationHistory.raw}`
  );
  assert.ok(Array.isArray(teacherNotificationHistory.body?.data), "Teacher notification history should include data array");
  assert.ok(
    (teacherNotificationHistory.body?.summary?.totalRuns ?? 0) >= 1,
    "Teacher notification history should report at least one run"
  );
  const latestNotificationHistory = teacherNotificationHistory.body?.data?.[0];
  assert.ok(latestNotificationHistory?.id, "Teacher notification history should include run id");
  const latestHistoryClassResult = (latestNotificationHistory?.classResults ?? []).find((item) => item.classId === examClass.id);
  assert.ok(latestHistoryClassResult, "Teacher notification history should include selected class result");
  assert.equal(latestHistoryClassResult?.rule?.includeParents, false);
  assert.ok(
    (latestHistoryClassResult?.sampleAssignments ?? []).some((item) => item.assignmentId === submissionAssignmentId),
    "Teacher notification history should include the created upload assignment sample"
  );

  const teacherSubmissions = await apiFetch(`/api/teacher/submissions?classId=${examClass.id}&status=pending`);
  assert.equal(teacherSubmissions.status, 200, `GET /api/teacher/submissions failed: ${teacherSubmissions.raw}`);
  assert.ok(Array.isArray(teacherSubmissions.body?.data), "Teacher submissions should include data array");
  assert.ok(Array.isArray(teacherSubmissions.body?.classes), "Teacher submissions should include classes array");
  const targetSubmission = (teacherSubmissions.body?.data ?? []).find(
    (item) => item.assignmentId === submissionAssignmentId && item.studentId === targetStudent.id
  );
  assert.ok(targetSubmission, "Teacher submissions should include the created upload assignment row");
  assert.equal(targetSubmission?.status, "pending", "Created upload assignment should be pending for target student");
  assert.equal(
    targetSubmission?.submissionType,
    "upload",
    "Teacher submissions should expose upload submissionType"
  );

  const examSuffix = Date.now().toString(36);
  const createExam = await apiFetch("/api/teacher/exams", {
    method: "POST",
    json: {
      classId: examClass.id,
      title: `API_TEST_EXAM_${examSuffix}`,
      publishMode: "targeted",
      antiCheatLevel: "basic",
      studentIds: [targetStudent.id],
      endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      questionCount: 1,
      difficulty: "medium",
      questionType: "choice"
    }
  });
  assert.equal(createExam.status, 200, `POST /api/teacher/exams failed: ${createExam.raw}`);
  const createdExamId = createExam.body?.data?.id;
  assert.ok(createdExamId, "Create exam should return data.id");
  assert.equal(
    createExam.body?.data?.publishMode,
    "targeted",
    "Create exam should return publishMode"
  );
  assert.equal(createExam.body?.data?.antiCheatLevel, "basic", "Create exam should return antiCheatLevel");
  assert.equal(createExam.body?.data?.assignedCount, 1, "Targeted exam should assign selected students only");
  state.createdExamId = createdExamId;

  const teacherExamList = await apiFetch("/api/teacher/exams");
  assert.equal(teacherExamList.status, 200, `GET /api/teacher/exams failed: ${teacherExamList.raw}`);
  assert.ok(Array.isArray(teacherExamList.body?.data), "Teacher exams should include data array");
  const createdExamInList = (teacherExamList.body?.data ?? []).find((item) => item.id === createdExamId);
  assert.ok(createdExamInList, "Created exam should appear in teacher exam list");
  assert.equal(createdExamInList?.publishMode, "targeted");
  assert.equal(createdExamInList?.antiCheatLevel, "basic");

  const teacherExamDetail = await apiFetch(`/api/teacher/exams/${createdExamId}`);
  assert.equal(teacherExamDetail.status, 200, `GET /api/teacher/exams/[id] failed: ${teacherExamDetail.raw}`);
  assert.ok(Array.isArray(teacherExamDetail.body?.students), "Teacher exam detail should include students");
  assert.equal(teacherExamDetail.body?.summary?.assigned, 1, "Targeted exam detail should only include assigned students");

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

  const studentNotifications = await apiFetch("/api/notifications");
  assert.equal(studentNotifications.status, 200, `Student GET /api/notifications failed: ${studentNotifications.raw}`);
  assert.ok(Array.isArray(studentNotifications.body?.data), "Student notifications should include data array");
  const assignmentNotification = (studentNotifications.body?.data ?? []).find(
    (item) => item.type === "assignment" && item.content?.includes(submissionAssignment.body?.data?.title ?? "")
  );
  assert.ok(assignmentNotification, "Student notifications should include the created assignment notification");
  const reminderNotification = (studentNotifications.body?.data ?? []).find(
    (item) => item.type === "assignment_due" && item.content?.includes(submissionAssignment.body?.data?.title ?? "")
  );
  assert.ok(reminderNotification, "Student notifications should include due reminder after manual notification run");

  const studentInboxThreads = await apiFetch("/api/inbox/threads");
  assert.equal(studentInboxThreads.status, 200, `Student GET /api/inbox/threads failed: ${studentInboxThreads.raw}`);
  assert.ok(Array.isArray(studentInboxThreads.body?.data), "Student inbox threads should include data array");
  const studentInboxThread = (studentInboxThreads.body?.data ?? []).find((item) => item.id === teacherInboxThreadId);
  assert.ok(studentInboxThread, "Student inbox should include teacher-created thread");
  assert.equal(studentInboxThread?.subject, teacherInboxThreadSubject);
  assert.ok((studentInboxThread?.unreadCount ?? 0) >= 1, "Student should see unread count for teacher-created thread");

  const studentInboxDetail = await apiFetch(`/api/inbox/threads/${teacherInboxThreadId}`);
  assert.equal(studentInboxDetail.status, 200, `Student GET /api/inbox/threads/[id] failed: ${studentInboxDetail.raw}`);
  assert.equal(studentInboxDetail.body?.data?.thread?.subject, teacherInboxThreadSubject);
  assert.ok(Array.isArray(studentInboxDetail.body?.data?.messages), "Student inbox detail should include messages array");
  assert.ok((studentInboxDetail.body?.data?.messages?.length ?? 0) >= 1, "Student inbox detail should include at least one message");

  const studentInboxThreadsAfterRead = await apiFetch("/api/inbox/threads");
  assert.equal(
    studentInboxThreadsAfterRead.status,
    200,
    `Student GET /api/inbox/threads after read failed: ${studentInboxThreadsAfterRead.raw}`
  );
  const studentThreadAfterRead = (studentInboxThreadsAfterRead.body?.data ?? []).find((item) => item.id === teacherInboxThreadId);
  assert.equal(studentThreadAfterRead?.unreadCount, 0, "Opening thread detail should clear student unread count");

  const studentReplyContent = `API_TEST_REPLY_${Date.now().toString(36)}`;
  const studentInboxReply = await apiFetch(`/api/inbox/threads/${teacherInboxThreadId}/messages`, {
    method: "POST",
    json: { content: studentReplyContent }
  });
  assert.equal(studentInboxReply.status, 200, `Student POST /api/inbox/threads/[id]/messages failed: ${studentInboxReply.raw}`);
  assert.ok(studentInboxReply.body?.data?.id, "Student inbox reply should return message id");

  const studentInboxDetailAfterReply = await apiFetch(`/api/inbox/threads/${teacherInboxThreadId}`);
  assert.equal(
    studentInboxDetailAfterReply.status,
    200,
    `Student GET /api/inbox/threads/[id] after reply failed: ${studentInboxDetailAfterReply.raw}`
  );
  assert.ok(
    (studentInboxDetailAfterReply.body?.data?.messages ?? []).some((item) => item.content === studentReplyContent),
    "Student inbox detail should include the new reply"
  );

  const tutorShareTargets = await apiFetch("/api/ai/share-targets");
  assert.equal(tutorShareTargets.status, 200, `Student GET /api/ai/share-targets failed: ${tutorShareTargets.raw}`);
  const teacherShareTarget =
    (tutorShareTargets.body?.data ?? []).find((item) => item.kind === "teacher" && item.id === examClass.teacherId) ??
    (tutorShareTargets.body?.data ?? []).find((item) => item.kind === "teacher");
  assert.ok(teacherShareTarget, "Student tutor-share targets should include current teacher");

  const tutorShareTeacherQuestion = "老师您好，我拍题后确认 5/8 + 1/8 等于多少？";
  const tutorShareTeacherAnswer = "3/4";
  const tutorShareToTeacher = await apiFetch("/api/ai/share-result", {
    method: "POST",
    json: {
      targetId: teacherShareTarget.id,
      question: tutorShareTeacherQuestion,
      recognizedQuestion: "5/8 + 1/8 等于多少？",
      answer: tutorShareTeacherAnswer,
      origin: "image",
      subject: "math",
      grade: "4",
      answerMode: "step_by_step",
      provider: "mock",
      steps: ["分母相同，分子相加。", "5 + 1 = 6，得到 6/8。", "6/8 约分后等于 3/4。"],
      hints: ["先判断能否约分。"],
      quality: {
        confidenceScore: 92,
        riskLevel: "low",
        needsHumanReview: false,
        fallbackAction: "请老师继续帮忙确认讲解是否适合课堂进度。",
        reasons: ["同分母分数加法样例稳定"]
      }
    }
  });
  assert.equal(tutorShareToTeacher.status, 200, `POST /api/ai/share-result teacher failed: ${tutorShareToTeacher.raw}`);
  const tutorShareTeacherThreadId = tutorShareToTeacher.body?.data?.threadId;
  assert.ok(tutorShareTeacherThreadId, "Tutor share to teacher should return threadId");

  const tutorShareToTeacherAgain = await apiFetch("/api/ai/share-result", {
    method: "POST",
    json: {
      targetId: teacherShareTarget.id,
      question: tutorShareTeacherQuestion,
      recognizedQuestion: "5/8 + 1/8 等于多少？",
      answer: tutorShareTeacherAnswer,
      origin: "refine",
      subject: "math",
      grade: "4",
      answerMode: "step_by_step",
      provider: "mock",
      steps: ["先相加，再约分复核。"],
      hints: ["关注分子是否还能约。"]
    }
  });
  assert.equal(
    tutorShareToTeacherAgain.status,
    200,
    `POST /api/ai/share-result teacher second send failed: ${tutorShareToTeacherAgain.raw}`
  );
  assert.equal(tutorShareToTeacherAgain.body?.data?.reused, true, "Second tutor share to teacher should reuse thread");
  assert.equal(
    tutorShareToTeacherAgain.body?.data?.threadId,
    tutorShareTeacherThreadId,
    "Second tutor share to teacher should reuse the same threadId"
  );

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
  const wrongExamAnswer = "__API_TEST_WRONG_EXAM__";
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

  const reloginTeacherForClose = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email: teacherCandidates[0].email, password: teacherCandidates[0].password, role: "teacher" }
  });
  if (reloginTeacherForClose.status !== 200) {
    const fallbackTeacherLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: teacherCandidates[1].email, password: teacherCandidates[1].password, role: "teacher" }
    });
    assert.equal(fallbackTeacherLogin.status, 200, `Teacher relogin failed: ${fallbackTeacherLogin.raw}`);
  }

  const teacherTutorShareThreads = await apiFetch("/api/inbox/threads");
  assert.equal(teacherTutorShareThreads.status, 200, `Teacher GET /api/inbox/threads for tutor-share failed: ${teacherTutorShareThreads.raw}`);
  const teacherTutorShareThread = (teacherTutorShareThreads.body?.data ?? []).find((item) => item.id === tutorShareTeacherThreadId);
  assert.ok(teacherTutorShareThread, "Teacher inbox should include tutor-share thread from student");
  assert.ok((teacherTutorShareThread?.unreadCount ?? 0) >= 1, "Teacher should see tutor-share thread as unread before opening");

  const teacherTutorShareDetail = await apiFetch(`/api/inbox/threads/${tutorShareTeacherThreadId}`);
  assert.equal(
    teacherTutorShareDetail.status,
    200,
    `Teacher GET /api/inbox/threads/[id] for tutor-share failed: ${teacherTutorShareDetail.raw}`
  );
  assert.ok(
    (teacherTutorShareDetail.body?.data?.messages ?? []).some(
      (item) =>
        item.content?.includes("AI 解题结果分享") &&
        item.content?.includes("5/8 + 1/8") &&
        item.content?.includes(tutorShareTeacherAnswer)
    ),
    "Teacher tutor-share thread should include the shared tutor result"
  );

  const closeExam = await apiFetch(`/api/teacher/exams/${createdExamId}`, {
    method: "PATCH",
    json: { action: "close" }
  });
  assert.equal(closeExam.status, 200, `PATCH /api/teacher/exams/[id] close failed: ${closeExam.raw}`);
  assert.equal(closeExam.body?.data?.status, "closed", "Close action should set status=closed");

  const reloginStudentClosed = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email, password, role: "student" }
  });
  assert.equal(reloginStudentClosed.status, 200, `Student relogin failed: ${reloginStudentClosed.raw}`);

  const autosaveWhenClosed = await apiFetch(`/api/student/exams/${createdExamId}/autosave`, {
    method: "POST",
    json: {
      answers: {
        [firstExamQuestion.id]: examAnswer
      }
    }
  });
  assert.equal(autosaveWhenClosed.status, 400, "Closed exam should reject autosave");
  assert.equal(autosaveWhenClosed.body?.error, "考试已关闭");

  const reloginTeacherForReopen = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email: teacherCandidates[0].email, password: teacherCandidates[0].password, role: "teacher" }
  });
  if (reloginTeacherForReopen.status !== 200) {
    const fallbackTeacherLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: teacherCandidates[1].email, password: teacherCandidates[1].password, role: "teacher" }
    });
    assert.equal(fallbackTeacherLogin.status, 200, `Teacher relogin failed: ${fallbackTeacherLogin.raw}`);
  }

  const reopenExam = await apiFetch(`/api/teacher/exams/${createdExamId}`, {
    method: "PATCH",
    json: { action: "reopen" }
  });
  assert.equal(reopenExam.status, 200, `PATCH /api/teacher/exams/[id] reopen failed: ${reopenExam.raw}`);
  assert.equal(reopenExam.body?.data?.status, "published", "Reopen action should set status=published");

  const reloginStudentReopen = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email, password, role: "student" }
  });
  assert.equal(reloginStudentReopen.status, 200, `Student relogin failed: ${reloginStudentReopen.raw}`);

  const autosaveAfterReopen = await apiFetch(`/api/student/exams/${createdExamId}/autosave`, {
    method: "POST",
    json: {
      answers: {
        [firstExamQuestion.id]: examAnswer
      }
    }
  });
  assert.equal(autosaveAfterReopen.status, 200, "Reopened exam should accept autosave");

  const examEvents = await apiFetch(`/api/student/exams/${createdExamId}/events`, {
    method: "POST",
    json: {
      blurCountDelta: 20,
      visibilityHiddenCountDelta: 20
    }
  });
  assert.equal(examEvents.status, 200, `POST /api/student/exams/[id]/events failed: ${examEvents.raw}`);
  assert.equal(typeof examEvents.body?.data?.blurCount, "number");
  assert.equal(typeof examEvents.body?.data?.visibilityHiddenCount, "number");

  const examSubmit = await apiFetch(`/api/student/exams/${createdExamId}/submit`, {
    method: "POST",
    json: {
      answers: {
        [firstExamQuestion.id]: wrongExamAnswer
      }
    }
  });
  assert.equal(examSubmit.status, 200, `POST /api/student/exams/[id]/submit failed: ${examSubmit.raw}`);
  assert.equal(typeof examSubmit.body?.score, "number", "Exam submit should return score");
  assert.equal(typeof examSubmit.body?.total, "number", "Exam submit should return total");
  assert.ok((examSubmit.body?.wrongCount ?? 0) >= 1, "Exam submit should return wrongCount >= 1");
  assert.ok(
    (examSubmit.body?.queuedReviewCount ?? 0) >= 1,
    "Exam submit should queue wrong questions into review queue"
  );
  assert.equal(examSubmit.body?.alreadySubmitted, false, "First submit should not be alreadySubmitted");

  const reviewQueueAfterExam = await apiFetch("/api/wrong-book/review-queue");
  assert.equal(
    reviewQueueAfterExam.status,
    200,
    `GET /api/wrong-book/review-queue after exam submit failed: ${reviewQueueAfterExam.raw}`
  );
  const reviewQueueItems = [
    ...(reviewQueueAfterExam.body?.data?.today ?? []),
    ...(reviewQueueAfterExam.body?.data?.upcoming ?? [])
  ];
  const reviewFromExam = reviewQueueItems.find((item) => item.questionId === firstExamQuestion.id);
  assert.ok(reviewFromExam, "Exam wrong question should appear in review queue");
  assert.equal(reviewFromExam?.intervalLevel, 1, "Exam wrong question should reset to intervalLevel 1");
  assert.equal(reviewFromExam?.lastReviewResult, "wrong", "Exam wrong question should mark lastReviewResult=wrong");
  assert.equal(reviewFromExam?.originType, "exam", "Exam wrong question should keep originType=exam");
  assert.equal(reviewFromExam?.originPaperId, createdExamId, "Exam wrong question should keep originPaperId");
  assert.equal(typeof reviewFromExam?.originSubmittedAt, "string", "Exam wrong question should expose originSubmittedAt");

  const examSubmitAgain = await apiFetch(`/api/student/exams/${createdExamId}/submit`, {
    method: "POST",
    json: {
      answers: {
        [firstExamQuestion.id]: wrongExamAnswer
      }
    }
  });
  assert.equal(examSubmitAgain.status, 200, `Second submit should be idempotent: ${examSubmitAgain.raw}`);
  assert.equal(
    examSubmitAgain.body?.queuedReviewCount,
    0,
    "Second submit should not enqueue wrong-review queue again"
  );
  assert.equal(examSubmitAgain.body?.alreadySubmitted, true);

  const studentExamsAfterSubmit = await apiFetch("/api/student/exams");
  assert.equal(
    studentExamsAfterSubmit.status,
    200,
    `GET /api/student/exams after submit failed: ${studentExamsAfterSubmit.raw}`
  );
  const submittedExam = (studentExamsAfterSubmit.body?.data ?? []).find((item) => item.id === createdExamId);
  assert.equal(submittedExam?.status, "submitted", "Student exam should be marked as submitted");

  const reloginTeacher = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email: teacherCandidates[0].email, password: teacherCandidates[0].password, role: "teacher" }
  });
  if (reloginTeacher.status !== 200) {
    const fallbackTeacherLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: teacherCandidates[1].email, password: teacherCandidates[1].password, role: "teacher" }
    });
    assert.equal(fallbackTeacherLogin.status, 200, `Teacher relogin failed: ${fallbackTeacherLogin.raw}`);
  }

  const teacherExamDetailAfter = await apiFetch(`/api/teacher/exams/${createdExamId}`);
  assert.equal(
    teacherExamDetailAfter.status,
    200,
    `GET /api/teacher/exams/[id] after submit failed: ${teacherExamDetailAfter.raw}`
  );
  const monitoredStudent = (teacherExamDetailAfter.body?.students ?? []).find((item) => item.email === email);
  assert.ok(monitoredStudent, "Teacher detail should include monitored student");
  assert.ok(
    (monitoredStudent?.blurCount ?? 0) >= 20,
    "Teacher detail should include blurCount from exam events"
  );
  assert.ok(
    (monitoredStudent?.visibilityHiddenCount ?? 0) >= 20,
    "Teacher detail should include visibilityHiddenCount from exam events"
  );

  const publishReviewPackDryRun = await apiFetch(
    `/api/teacher/exams/${createdExamId}/review-pack/publish`,
    {
      method: "POST",
      json: {
        minRiskLevel: "low",
        includeParents: false,
        dryRun: true
      }
    }
  );
  assert.equal(
    publishReviewPackDryRun.status,
    200,
    `POST /api/teacher/exams/[id]/review-pack/publish dryRun failed: ${publishReviewPackDryRun.raw}`
  );
  assert.equal(publishReviewPackDryRun.body?.data?.dryRun, true);
  assert.equal(
    typeof publishReviewPackDryRun.body?.data?.targetedStudents,
    "number",
    "Review-pack publish dryRun should include targetedStudents"
  );
  assert.ok(
    Array.isArray(publishReviewPackDryRun.body?.data?.published),
    "Review-pack publish dryRun should include published list"
  );

  const publishReviewPack = await apiFetch(`/api/teacher/exams/${createdExamId}/review-pack/publish`, {
    method: "POST",
    json: {
      minRiskLevel: "low",
      includeParents: false,
      dryRun: false
    }
  });
  assert.equal(
    publishReviewPack.status,
    200,
    `POST /api/teacher/exams/[id]/review-pack/publish failed: ${publishReviewPack.raw}`
  );
  assert.equal(publishReviewPack.body?.data?.dryRun, false);
  assert.ok(
    (publishReviewPack.body?.data?.publishedStudents ?? 0) >= 1,
    "Review-pack publish should notify at least one student"
  );

  const teacherOutline = await apiFetch("/api/teacher/lesson/outline", {
    method: "POST",
    json: {
      classId: examClass.id,
      topic: `API_TEST_EXAM_OUTLINE_${examSuffix}`
    }
  });
  assert.equal(teacherOutline.status, 200, `POST /api/teacher/lesson/outline failed: ${teacherOutline.raw}`);
  assert.equal(
    typeof teacherOutline.body?.data?.quality?.confidenceScore,
    "number",
    "Lesson outline should include quality.confidenceScore"
  );
  assert.equal(
    typeof teacherOutline.body?.data?.quality?.riskLevel,
    "string",
    "Lesson outline should include quality.riskLevel"
  );
  assert.equal(
    typeof teacherOutline.body?.data?.quality?.minQualityScore,
    "number",
    "Lesson outline should include quality.minQualityScore"
  );
  assert.equal(
    typeof teacherOutline.body?.data?.quality?.policyViolated,
    "boolean",
    "Lesson outline should include quality.policyViolated"
  );

  const wrongReviewScript = await apiFetch("/api/teacher/lesson/wrong-review", {
    method: "POST",
    json: { classId: examClass.id, rangeDays: 7 }
  });
  assert.equal(
    wrongReviewScript.status,
    200,
    `POST /api/teacher/lesson/wrong-review failed: ${wrongReviewScript.raw}`
  );
  assert.equal(
    typeof wrongReviewScript.body?.data?.quality?.confidenceScore,
    "number",
    "Wrong-review script should include quality.confidenceScore"
  );
  assert.equal(
    wrongReviewScript.body?.data?.quality?.taskType,
    "wrong_review_script",
    "Wrong-review script should include mapped quality.taskType"
  );

  const classReviewPack = await apiFetch("/api/teacher/lesson/review-pack", {
    method: "POST",
    json: { classId: examClass.id, rangeDays: 7 }
  });
  assert.equal(
    classReviewPack.status,
    200,
    `POST /api/teacher/lesson/review-pack failed: ${classReviewPack.raw}`
  );
  assert.ok(
    Array.isArray(classReviewPack.body?.data?.afterClassReviewSheet),
    "Class review-pack should include afterClassReviewSheet"
  );
  assert.ok(
    Array.isArray(classReviewPack.body?.data?.commonCauseStats),
    "Class review-pack should include commonCauseStats"
  );
  assert.equal(
    typeof classReviewPack.body?.data?.quality?.confidenceScore,
    "number",
    "Class review-pack should include quality.confidenceScore"
  );
  assert.equal(
    classReviewPack.body?.data?.quality?.taskType,
    "wrong_review_script",
    "Class review-pack should include mapped quality.taskType"
  );
  const firstCause = classReviewPack.body?.data?.commonCauseStats?.[0];
  if (firstCause) {
    assert.equal(typeof firstCause.causeKey, "string", "commonCauseStats item should include causeKey");
    assert.equal(typeof firstCause.ratio, "number", "commonCauseStats item should include ratio");
    assert.equal(typeof firstCause.classAction, "string", "commonCauseStats item should include classAction");
  }
  const firstSheet = classReviewPack.body?.data?.afterClassReviewSheet?.[0];
  if (firstSheet) {
    assert.equal(
      typeof firstSheet.knowledgePointId,
      "string",
      "Class review-pack sheet item should include knowledgePointId"
    );
  }

  const generatedLibraryLesson = await apiFetch("/api/teacher/library/ai-generate", {
    method: "POST",
    json: {
      classId: examClass.id,
      topic: `API_TEST_LIBRARY_LESSON_${examSuffix}`,
      contentType: "lesson_plan"
    }
  });
  assert.equal(
    generatedLibraryLesson.status,
    200,
    `POST /api/teacher/library/ai-generate failed: ${generatedLibraryLesson.raw}`
  );
  assert.equal(
    typeof generatedLibraryLesson.body?.data?.quality?.confidenceScore,
    "number",
    "Library ai-generate should include quality.confidenceScore"
  );
  assert.equal(
    typeof generatedLibraryLesson.body?.data?.quality?.needsHumanReview,
    "boolean",
    "Library ai-generate should include quality.needsHumanReview"
  );

  const teacherAlertsAfterExamEvents = await apiFetch("/api/teacher/alerts");
  assert.equal(
    teacherAlertsAfterExamEvents.status,
    200,
    `GET /api/teacher/alerts after exam events failed: ${teacherAlertsAfterExamEvents.raw}`
  );
  const studentRiskAlert = (teacherAlertsAfterExamEvents.body?.data?.alerts ?? []).find(
    (item) => item.type === "student-risk" && item.student?.email === email
  );
  assert.ok(studentRiskAlert, "Teacher alerts should include student-risk alert after exam anomalies");
  assert.equal(
    typeof studentRiskAlert?.metrics?.examAnomalyCount,
    "number",
    "Teacher student-risk alert should include examAnomalyCount metric"
  );
  assert.ok(
    (studentRiskAlert?.metrics?.examAnomalyCount ?? 0) >= 40,
    "Teacher alert should reflect high exam anomaly count"
  );

  const assignReviewAction = await apiFetch(`/api/teacher/alerts/${studentRiskAlert.id}/action`, {
    method: "POST",
    json: { actionType: "assign_review" }
  });
  assert.equal(
    assignReviewAction.status,
    200,
    `POST /api/teacher/alerts/[id]/action assign_review failed: ${assignReviewAction.raw}`
  );
  assert.ok(
    (assignReviewAction.body?.data?.result?.createdTasks ?? 0) >= 1,
    "Teacher alert action assign_review should create correction tasks"
  );
  assert.equal(
    assignReviewAction.body?.data?.lastActionType,
    "assign_review",
    "Teacher alert action should return lastActionType"
  );

  const notifyAction = await apiFetch(`/api/teacher/alerts/${studentRiskAlert.id}/action`, {
    method: "POST",
    json: { actionType: "notify_student" }
  });
  assert.equal(
    notifyAction.status,
    200,
    `POST /api/teacher/alerts/[id]/action notify_student failed: ${notifyAction.raw}`
  );
  assert.ok(
    (notifyAction.body?.data?.result?.notifications ?? 0) >= 1,
    "Teacher alert action notify_student should send notifications"
  );

  const markDoneAction = await apiFetch(`/api/teacher/alerts/${studentRiskAlert.id}/action`, {
    method: "POST",
    json: { actionType: "mark_done" }
  });
  assert.equal(
    markDoneAction.status,
    200,
    `POST /api/teacher/alerts/[id]/action mark_done failed: ${markDoneAction.raw}`
  );
  assert.equal(markDoneAction.body?.data?.status, "acknowledged");

  const alertImpact = await apiFetch(`/api/teacher/alerts/${studentRiskAlert.id}/impact`);
  assert.equal(alertImpact.status, 200, `GET /api/teacher/alerts/[id]/impact failed: ${alertImpact.raw}`);
  assert.equal(alertImpact.body?.data?.alertId, studentRiskAlert.id);
  assert.equal(typeof alertImpact.body?.data?.impact?.tracked, "boolean");
  assert.equal(typeof alertImpact.body?.data?.impact?.elapsedHours, "number");
}
