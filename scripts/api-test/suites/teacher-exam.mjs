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
  async function loginTeacherCandidate(candidate) {
    return apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: candidate.email, password: candidate.password, role: "teacher" }
    });
  }

  let teacherLogin = null;
  let activeTeacherCandidate = teacherCandidates[0];
  for (const candidate of teacherCandidates) {
    const resp = await loginTeacherCandidate(candidate);
    if (resp.status === 200) {
      teacherLogin = resp;
      activeTeacherCandidate = candidate;
      break;
    }
  }
  assert.equal(teacherLogin?.status, 200, "Teacher login failed for both primary and fallback accounts");

  async function reloginTeacherAccount(preferredCandidate = activeTeacherCandidate) {
    const candidates = [preferredCandidate, ...teacherCandidates.filter((item) => item.email !== preferredCandidate.email)];
    for (const candidate of candidates) {
      const resp = await loginTeacherCandidate(candidate);
      if (resp.status === 200) {
        activeTeacherCandidate = candidate;
        return resp;
      }
    }
    assert.fail("Teacher relogin failed");
  }

  async function saveStudentProfileAsStudent(studentEmail, studentPassword, profilePatch) {
    const login = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: studentEmail, password: studentPassword, role: "student" }
    });
    assert.equal(login.status, 200, `Student login failed for profile save: ${login.raw}`);

    const saveProfile = await apiFetch("/api/student/profile", {
      method: "PUT",
      json: {
        grade: profilePatch.grade ?? "4",
        subjects: profilePatch.subjects ?? ["math", "english"],
        target: profilePatch.target ?? "课堂协作与成绩提升",
        school: profilePatch.school ?? "API测试学校",
        preferredName: profilePatch.preferredName ?? null,
        gender: profilePatch.gender ?? null,
        heightCm: profilePatch.heightCm ?? null,
        eyesightLevel: profilePatch.eyesightLevel ?? null,
        seatPreference: profilePatch.seatPreference ?? null,
        personality: profilePatch.personality ?? null,
        focusSupport: profilePatch.focusSupport ?? null,
        peerSupport: profilePatch.peerSupport ?? null,
        strengths: profilePatch.strengths ?? "",
        supportNotes: profilePatch.supportNotes ?? ""
      }
    });
    assert.equal(saveProfile.status, 200, `PUT /api/student/profile failed: ${saveProfile.raw}`);
    return saveProfile;
  }

  const teacherDashboardOverview = await apiFetch("/api/dashboard/overview");
  assert.equal(teacherDashboardOverview.status, 200, `Teacher GET /api/dashboard/overview failed: ${teacherDashboardOverview.raw}`);
  assert.equal(teacherDashboardOverview.body?.data?.role, "teacher", "Teacher dashboard overview should detect teacher role");
  assert.ok(Array.isArray(teacherDashboardOverview.body?.data?.alerts), "Teacher dashboard overview should include alerts");
  const teacherCalendarQuickAction = (teacherDashboardOverview.body?.data?.quickActions ?? []).find((item) => item.id === "teacher-calendar");
  assert.ok(teacherCalendarQuickAction, "Teacher dashboard overview should include calendar quick action");
  assert.equal(teacherCalendarQuickAction?.href, "/calendar");
  const teacherSeatingQuickAction = (teacherDashboardOverview.body?.data?.quickActions ?? []).find((item) => item.id === "teacher-seating");
  assert.ok(teacherSeatingQuickAction, "Teacher dashboard overview should include seating quick action");
  assert.equal(teacherSeatingQuickAction?.href, "/teacher/seating");

  const teacherSchedule = await apiFetch("/api/schedule");
  assert.equal(teacherSchedule.status, 200, `Teacher GET /api/schedule failed: ${teacherSchedule.raw}`);
  assert.equal(teacherSchedule.body?.data?.role, "teacher", "Schedule API should detect teacher role");
  assert.ok(Array.isArray(teacherSchedule.body?.data?.weekly), "Teacher schedule should include weekly lessons");
  let workingTeacherSchedule = teacherSchedule;
  if (!workingTeacherSchedule.body?.data?.nextLesson) {
    const fallbackTeacher = teacherCandidates.find((item) => item.email !== activeTeacherCandidate.email);
    if (fallbackTeacher) {
      const fallbackLogin = await reloginTeacherAccount(fallbackTeacher);
      assert.equal(fallbackLogin.status, 200, `Teacher fallback login failed: ${fallbackLogin.raw}`);
      workingTeacherSchedule = await apiFetch("/api/schedule");
      assert.equal(workingTeacherSchedule.status, 200, `Teacher fallback GET /api/schedule failed: ${workingTeacherSchedule.raw}`);
    }
  }

  const prestudyLesson = workingTeacherSchedule.body?.data?.nextLesson ?? null;
  if (prestudyLesson?.classId && prestudyLesson?.date) {
    const addPrestudyStudent = await apiFetch(`/api/teacher/classes/${prestudyLesson.classId}/students`, {
      method: "POST",
      json: { email }
    });
    assert.equal(
      addPrestudyStudent.status,
      200,
      `POST /api/teacher/classes/[id]/students for prestudy failed: ${addPrestudyStudent.raw}`
    );

    const prestudyTitle = `API_TEST_PRESTUDY_${Date.now().toString(36)}`;
    const createPrestudy = await apiFetch("/api/teacher/schedule-prestudy", {
      method: "POST",
      json: {
        classId: prestudyLesson.classId,
        scheduleSessionId: prestudyLesson.id,
        lessonDate: prestudyLesson.date,
        title: prestudyTitle,
        description: "API 测试课表预习任务",
        submissionType: "essay",
        gradingFocus: "课前知识梳理"
      }
    });
    assert.equal(createPrestudy.status, 200, `POST /api/teacher/schedule-prestudy failed: ${createPrestudy.raw}`);
    const prestudyAssignmentId = createPrestudy.body?.data?.id;
    assert.ok(prestudyAssignmentId, "Schedule prestudy API should return assignment id");

    const teacherScheduleAfterPrestudy = await apiFetch("/api/schedule");
    assert.equal(
      teacherScheduleAfterPrestudy.status,
      200,
      `Teacher GET /api/schedule after prestudy failed: ${teacherScheduleAfterPrestudy.raw}`
    );
    assert.equal(
      teacherScheduleAfterPrestudy.body?.data?.nextLesson?.prestudyAssignmentId,
      prestudyAssignmentId,
      "Teacher next lesson should include linked prestudy assignment"
    );
    assert.equal(
      typeof teacherScheduleAfterPrestudy.body?.data?.nextLesson?.prestudyTotalCount,
      "number",
      "Teacher next lesson should expose prestudy total count"
    );

    const teacherPrestudyDetail = await apiFetch(`/api/teacher/assignments/${prestudyAssignmentId}`);
    assert.equal(
      teacherPrestudyDetail.status,
      200,
      `Teacher GET /api/teacher/assignments/[id] for prestudy failed: ${teacherPrestudyDetail.raw}`
    );
    assert.equal(teacherPrestudyDetail.body?.lessonLink?.taskKind, "prestudy", "Teacher assignment detail should expose prestudy link");
    assert.equal(teacherPrestudyDetail.body?.lessonLink?.lessonDate, prestudyLesson.date);

    const reloginStudent = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email, password, role: "student" }
    });
    assert.equal(reloginStudent.status, 200, `Student relogin for prestudy failed: ${reloginStudent.raw}`);

    const studentScheduleAfterPrestudy = await apiFetch("/api/schedule");
    assert.equal(
      studentScheduleAfterPrestudy.status,
      200,
      `Student GET /api/schedule after prestudy failed: ${studentScheduleAfterPrestudy.raw}`
    );
    const studentLinkedLesson =
      studentScheduleAfterPrestudy.body?.data?.nextLesson?.prestudyAssignmentId === prestudyAssignmentId
        ? studentScheduleAfterPrestudy.body?.data?.nextLesson
        : (studentScheduleAfterPrestudy.body?.data?.weekly ?? [])
            .flatMap((day) => day.lessons ?? [])
            .find((lesson) => lesson.prestudyAssignmentId === prestudyAssignmentId);
    assert.ok(studentLinkedLesson, "Student schedule should surface the linked prestudy assignment");
    assert.equal(studentLinkedLesson?.prestudyAssignmentTitle, prestudyTitle);
    assert.equal(studentLinkedLesson?.prestudyAssignmentStatus, "pending", "Student linked prestudy should start pending");

    const studentPrestudyDetail = await apiFetch(`/api/student/assignments/${prestudyAssignmentId}`);
    assert.equal(
      studentPrestudyDetail.status,
      200,
      `Student GET /api/student/assignments/[id] for prestudy failed: ${studentPrestudyDetail.raw}`
    );
    assert.equal(studentPrestudyDetail.body?.lessonLink?.taskKind, "prestudy", "Student assignment detail should expose prestudy link");
    assert.equal(studentPrestudyDetail.body?.lessonLink?.lessonDate, prestudyLesson.date);

    const studentCalendarAfterPrestudy = await apiFetch("/api/calendar");
    assert.equal(
      studentCalendarAfterPrestudy.status,
      200,
      `Student GET /api/calendar after prestudy failed: ${studentCalendarAfterPrestudy.raw}`
    );
    assert.ok(
      (studentCalendarAfterPrestudy.body?.data ?? []).some(
        (item) => item.id === prestudyAssignmentId && String(item.title ?? "").startsWith("预习任务：")
      ),
      "Student calendar should mark linked assignments as prestudy"
    );

    await reloginTeacherAccount();
  }

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

  const seatingStudentSeeds = Array.from(
    new Map(
      [
        {
          email,
          password,
          grade: "4",
          subjects: ["math", "english"],
          target: "提升课堂参与与同桌协作",
          school: "API测试学校",
          preferredName: "前排同学",
          gender: "female",
          heightCm: 142,
          eyesightLevel: "front_preferred",
          seatPreference: "front",
          personality: "quiet",
          focusSupport: "needs_focus",
          peerSupport: "needs_support",
          strengths: "专注度高，适合安静座位",
          supportNotes: "希望优先保证前排视野"
        },
        {
          email: "student2@demo.com",
          password: "Student123",
          grade: "4",
          subjects: ["math", "science"],
          target: "提升应用题协作与口头表达",
          school: "API测试学校",
          preferredName: "协作搭档",
          gender: "male",
          heightCm: 155,
          eyesightLevel: "normal",
          seatPreference: "middle",
          personality: "active",
          focusSupport: "balanced",
          peerSupport: "can_support",
          strengths: "讨论积极，愿意帮助同学",
          supportNotes: "适合与安静同学配对形成互补"
        },
        {
          email: "student3@demo.com",
          password: "Student123",
          grade: "4",
          subjects: ["math", "chinese"],
          target: "提升稳定性和课堂专注",
          school: "API测试学校",
          preferredName: "后排高个",
          gender: "female",
          heightCm: 168,
          eyesightLevel: "normal",
          seatPreference: "back",
          personality: "balanced",
          focusSupport: "self_driven",
          peerSupport: undefined,
          strengths: "",
          supportNotes: "身高较高，优先安排后排或中后排"
        }
      ].map((item) => [item.email, item])
    ).values()
  );

  for (const seatSeed of seatingStudentSeeds) {
    if (seatSeed.email === email) continue;
    const addSeatStudent = await apiFetch(`/api/teacher/classes/${examClass.id}/students`, {
      method: "POST",
      json: { email: seatSeed.email }
    });
    assert.equal(
      addSeatStudent.status,
      200,
      `POST /api/teacher/classes/[id]/students for seating seed failed: ${addSeatStudent.raw}`
    );
  }

  const classStudentsForSeating = await apiFetch(`/api/teacher/classes/${examClass.id}/students`);
  assert.equal(
    classStudentsForSeating.status,
    200,
    `GET /api/teacher/classes/[id]/students for seating failed: ${classStudentsForSeating.raw}`
  );
  assert.ok(
    (classStudentsForSeating.body?.data ?? []).length >= Math.min(3, seatingStudentSeeds.length),
    "Teacher class roster should include seating test students"
  );

  const targetProfileSave = await saveStudentProfileAsStudent(seatingStudentSeeds[0].email, seatingStudentSeeds[0].password, seatingStudentSeeds[0]);
  assert.equal(
    targetProfileSave.body?.data?.preferredName,
    seatingStudentSeeds[0].preferredName,
    "Student profile save should persist preferredName"
  );
  assert.equal(
    targetProfileSave.body?.data?.seatPreference,
    seatingStudentSeeds[0].seatPreference,
    "Student profile save should persist seatPreference"
  );

  const targetProfileGet = await apiFetch("/api/student/profile");
  assert.equal(targetProfileGet.status, 200, `GET /api/student/profile failed: ${targetProfileGet.raw}`);
  assert.equal(targetProfileGet.body?.data?.preferredName, seatingStudentSeeds[0].preferredName);
  assert.equal(targetProfileGet.body?.data?.heightCm, seatingStudentSeeds[0].heightCm);
  assert.equal(targetProfileGet.body?.data?.focusSupport, seatingStudentSeeds[0].focusSupport);
  assert.equal(targetProfileGet.body?.data?.peerSupport, seatingStudentSeeds[0].peerSupport);
  assert.ok(
    Array.isArray(targetProfileGet.body?.data?.missingPersonaFields),
    "Student profile GET should expose missingPersonaFields"
  );
  assert.equal(
    typeof targetProfileGet.body?.data?.profileCompleteness,
    "number",
    "Student profile GET should expose profileCompleteness"
  );

  for (const seatSeed of seatingStudentSeeds.slice(1)) {
    const saveProfile = await saveStudentProfileAsStudent(seatSeed.email, seatSeed.password, seatSeed);
    assert.equal(saveProfile.body?.data?.preferredName, seatSeed.preferredName);
  }

  await reloginTeacherAccount();

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

  const reloginTeacherForClose = await reloginTeacherAccount();
  assert.equal(reloginTeacherForClose.status, 200, `Teacher relogin failed: ${reloginTeacherForClose.raw}`);

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

  const reloginTeacherForReopen = await reloginTeacherAccount();
  assert.equal(reloginTeacherForReopen.status, 200, `Teacher relogin failed: ${reloginTeacherForReopen.raw}`);

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

  const reloginTeacher = await reloginTeacherAccount();
  assert.equal(reloginTeacher.status, 200, `Teacher relogin failed: ${reloginTeacher.raw}`);

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

  const teacherSeatingData = await apiFetch(`/api/teacher/seating?classId=${examClass.id}`);
  assert.equal(teacherSeatingData.status, 200, `GET /api/teacher/seating failed: ${teacherSeatingData.raw}`);
  assert.ok(Array.isArray(teacherSeatingData.body?.data?.classes), "Teacher seating should include classes array");
  assert.ok(Array.isArray(teacherSeatingData.body?.data?.students), "Teacher seating should include students array");
  assert.ok(
    (teacherSeatingData.body?.data?.students ?? []).length >= Math.min(3, seatingStudentSeeds.length),
    "Teacher seating should include enriched seating students"
  );
  const seatingTargetStudent = (teacherSeatingData.body?.data?.students ?? []).find((item) => item.email === email);
  assert.ok(seatingTargetStudent, "Teacher seating should include target student");
  assert.equal(typeof seatingTargetStudent?.profileCompleteness, "number");
  assert.equal(seatingTargetStudent?.focusSupport, seatingStudentSeeds[0].focusSupport);
  assert.equal(seatingTargetStudent?.peerSupport, seatingStudentSeeds[0].peerSupport);
  assert.ok(Array.isArray(seatingTargetStudent?.missingProfileFields));

  const lockedSeedSeat = (teacherSeatingData.body?.data?.plan?.seats ?? []).find(
    (seat) => seat.studentId && seat.studentId !== targetStudent.id
  );
  assert.ok(lockedSeedSeat?.studentId, "Teacher seating draft should provide a lockable assigned seat");

  const teacherSeatingPreview = await apiFetch("/api/teacher/seating/ai-preview", {
    method: "POST",
    json: {
      classId: examClass.id,
      rows: 2,
      columns: 2,
      balanceGender: true,
      pairByScoreComplement: true,
      respectHeightGradient: true,
      lockedSeats: lockedSeedSeat
        ? [
            {
              seatId: lockedSeedSeat.seatId,
              row: lockedSeedSeat.row,
              column: lockedSeedSeat.column,
              studentId: lockedSeedSeat.studentId
            }
          ]
        : []
    }
  });
  assert.equal(
    teacherSeatingPreview.status,
    200,
    `POST /api/teacher/seating/ai-preview failed: ${teacherSeatingPreview.raw}`
  );
  assert.ok(Array.isArray(teacherSeatingPreview.body?.data?.plan?.seats), "Teacher seating preview should include seats");
  assert.equal(typeof teacherSeatingPreview.body?.data?.summary?.assignedCount, "number");
  assert.equal(typeof teacherSeatingPreview.body?.data?.summary?.lockedSeatCount, "number");
  assert.ok(Array.isArray(teacherSeatingPreview.body?.data?.warnings), "Teacher seating preview should include warnings");
  assert.ok(Array.isArray(teacherSeatingPreview.body?.data?.insights), "Teacher seating preview should include insights");
  const lockedSeatAfterPreview = (teacherSeatingPreview.body?.data?.plan?.seats ?? []).find(
    (seat) => seat.row === lockedSeedSeat?.row && seat.column === lockedSeedSeat?.column
  );
  assert.equal(
    lockedSeatAfterPreview?.studentId,
    lockedSeedSeat?.studentId,
    "Teacher seating preview should preserve locked seat assignment"
  );
  const seatingFollowUp = await apiFetch("/api/teacher/seating/follow-up", {
    method: "POST",
    json: {
      classId: examClass.id,
      action: "remind_incomplete_profiles",
      includeParents: false,
      limit: 60
    }
  });
  assert.equal(seatingFollowUp.status, 200, `POST /api/teacher/seating/follow-up failed: ${seatingFollowUp.raw}`);
  assert.ok((seatingFollowUp.body?.data?.students ?? 0) >= 1, "Teacher seating follow-up should notify at least one student");
  assert.ok(
    (seatingFollowUp.body?.data?.recipients ?? []).some(
      (item) => Array.isArray(item.missingFields) && item.missingFields.length > 0 && typeof item.displayName === "string"
    ),
    "Teacher seating follow-up should return recipients with missing profile fields"
  );
  const previewTargetSeat = (teacherSeatingPreview.body?.data?.plan?.seats ?? []).find((seat) => seat.studentId === targetStudent.id);
  assert.ok(previewTargetSeat, "Teacher seating preview should place the target student");
  assert.equal(previewTargetSeat?.row, 1, "Front-priority student should be placed in the front row");

  const saveTeacherSeating = await apiFetch("/api/teacher/seating", {
    method: "POST",
    json: {
      classId: examClass.id,
      rows: teacherSeatingPreview.body?.data?.plan?.rows ?? 2,
      columns: teacherSeatingPreview.body?.data?.plan?.columns ?? 2,
      generatedBy: "ai",
      note: "API test seating save",
      seats: teacherSeatingPreview.body?.data?.plan?.seats ?? []
    }
  });
  assert.equal(saveTeacherSeating.status, 200, `POST /api/teacher/seating failed: ${saveTeacherSeating.raw}`);
  assert.equal(saveTeacherSeating.body?.data?.plan?.generatedBy, "ai");

  const teacherSeatingReload = await apiFetch(`/api/teacher/seating?classId=${examClass.id}`);
  assert.equal(teacherSeatingReload.status, 200, `GET /api/teacher/seating reload failed: ${teacherSeatingReload.raw}`);
  assert.equal(teacherSeatingReload.body?.data?.savedPlan?.generatedBy, "ai");
  assert.ok(
    (teacherSeatingReload.body?.data?.savedPlan?.seats ?? []).some((seat) => seat.studentId === targetStudent.id),
    "Reloaded teacher seating should persist saved seat assignments"
  );
}
