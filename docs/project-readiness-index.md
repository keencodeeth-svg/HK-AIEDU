# Project Readiness Index

更新时间：2026-03-21

用途：作为“当前项目状态 + P0 阻断项 + 测试 / 发布 / 运行时存储入口”的统一检索页。拿不准先看哪份文档时，先从这份开始。

## 1. 当前快照

- 项目阶段：已超过 MVP，更接近“可试点 beta 产品”，但还不是可规模复制的 release candidate。
- 当前规模：`68` 个页面、`191` 个 API 路由、`98` 个单测文件。
- 当前自动化：`test:unit` 当前为 `346` 条用例；`2` 个浏览器 smoke 文件，内含 `22` 条关键流程 smoke；其中 `tests/browser/smoke.spec.ts` 覆盖 `20` 条 production-like 主链路，`tests/browser/local-dev.spec.ts` 覆盖 `2` 条 local demo/dev 契约回归。
- 当前剩余文件态：当前工作树 `data/` 目录下还有 `23` 个 JSON 文件，`23` 个均已具备 DB canonical path，当前可见文件中已无 JSON-only 项。
- 当前前端收口重点：大页拆层和 latest-request-wins 加固已经覆盖 `school`、`practice`、`notifications`、`teacher notifications`、`teacher modules`、`teacher analysis`、`teacher seating`、`teacher ai tools`、`admin questions`、`admin knowledge points`、`teacher assignment detail`、`teacher assignment review`、`teacher exam detail`、`student assignment detail`、`student favorites`、`student profile`、`announcements`、`library`、`library detail`、`files`、`course`、`teacher exam create`、`student dashboard`、`student portrait`、`report`、`discussions`、`student exam detail`、`inbox`、`teacher dashboard`、`wrong-book`、`tutor`、`parent` 等高频工作台。
  其中 `school schedules` 已从单个超大 hook 拆为主编排层 + manual / AI / constraint actions，且 constraint actions 进一步拆成 template / teacher-rule / teacher-unavailability 三组动作层；`admin questions` 已进一步拆为主编排层 + page state / page effects / loaders / tool actions / list actions，并把知识点过滤、章节选项、分页范围、load error 合流和表单同步提成纯函数；`admin knowledge points` 已继续拆为主编排层 + page state / page effects / loaders / actions，并把 AI 章节回退、页码范围、load error 合流和列表派生提成纯函数；`teacher assignment detail` 已进一步拆为主编排层 + page state / page effects / loaders / actions，并把作业逾期判定、完成率、均分、提醒预览和学生名单派生提成纯函数；`teacher assignment review` 已继续拆为主编排层 + page state / page actions，并把批改模式派生、已存批改状态回填和保存 payload 提成纯函数；`teacher exam detail` 已进一步拆为主编排层 + page state / page effects / page actions，并把学生风险排序、刷新摘要、截止时间文案和复盘发布反馈提成纯函数；`student assignment detail` 已拆为主编排层 + loaders / actions，并把反馈加载判定、快照提示、提交回写与可提交状态派生提成纯函数；`student favorites` 已拆为主编排层 + loaders / actions，并把学科选项、标签排序、筛选结果和本地快照回写提成纯函数；`student profile` 已拆为主编排层 + loaders / actions，并把初始表单、学科切换、保存反馈和回写逻辑提成纯函数；`announcements` 已拆为主编排层 + loaders / actions，并把发布 payload、发布后反馈和页面数据判定提成纯函数；`notifications` 已拆为主编排层 + loaders / actions，并把筛选、已读计数、类型选项和本地已读回写提成纯函数；`discussions` 已继续拆为主编排层 + state / loaders / actions，并把 stage copy、话题筛选和页面派生状态提成纯函数；`inbox` 已继续拆为主编排层 + state / loaders / actions，并把当前会话、未读统计、筛选结果和 URL 目标线程匹配提成纯函数；`library` 已继续拆为主编排层 + page state / page effects / loaders / actions，并把资料筛选派生、教材导入表单约束、学科分组和展开态修剪提成纯函数；`library detail` 已拆为主编排层 + loaders / actions，并把知识点筛选、选区捕获与标注 payload 提成 `detail-utils.ts` 纯函数；`files` 已拆为主编排层 + loaders / actions，并把按文件夹分组与班级失效后的回退逻辑提成纯函数；`course` 已拆为主编排层 + loaders / actions，并把 syllabus 归一化、班级失效后的回退与提交类型文案提成纯函数。
  `teacher exam create` 已进一步拆为主编排层 + page state / page effects / loaders / actions，并把班级/知识点配置同步、目标学生裁剪、提交流程 payload、页面派生状态与刷新时间文案提成纯函数；`student dashboard` 已继续拆为主编排层 + page state / page effects / loaders / actions，并把优先任务聚合、入口可见性、任务曝光 payload 与 join success 文案提成纯函数；`student portrait` 已拆为主编排层 + page state / page effects / loaders，并把画像阶段文案、优先动作建议、Tutor 复用入口与总览 CTA 派生提成纯函数；`report` 已拆为主编排层 + page state / page effects / loaders，并把画像筛选、章节选项、过滤回退与热力图分组派生提成纯函数；`teacher ai tools` 已继续拆为主编排层 + page state / loaders / paper actions / workflow actions，并把表单 scope reset、班级切换恢复、知识点裁剪和 question-check preview 派生提成纯函数；`wrong-book` 已进一步拆为主编排层 + loaders / actions，并把默认截止日期、选题裁剪、busy/content 派生与刷新反馈文案提成纯函数；`tutor` 已继续拆为主编排层 + page state / page actions，并把历史回填、start-over 重置与模式文案派生提到 `tutorPageUtils.ts`；`parent` 已把并发加载链路抽到 `useParentPageLoaders.ts`、把回执与复制动作抽到 `useParentPageActions.ts`，并把订正任务分桶与提醒文案派生提到 `app/parent/utils.ts`；`student exam detail` 已继续拆为主编排层 + page state / page effects / loaders / submission actions / actions，并把计时锁定、结果区反馈、作答统计和 stage copy 派生提成纯函数；`teacher dashboard` 已继续拆为主编排层 + page state / class actions / workflow actions，并把知识点筛选、待审批入班、活跃预警、缺作业班级、临近截止作业与 dashboard 数据判定提成纯函数，`teacher seating` 已继续拆为主编排层 + page state / loaders / actions，并把锁定座位、排座草稿、待补画像、观察清单与学期状态派生提成纯函数；`teacher modules` 已进一步拆为主编排层 + page state / page effects / loaders / actions，`teacher analysis` 已进一步拆为主编排层 + page state / page effects / loaders / actions，并把热力图裁剪、骨架态、活跃预警数和最弱点派生为纯函数，`teacher notifications` 则已拆为主编排层 + loaders / actions。页面级请求下沉已经覆盖 `login / register / recover`、`focus / challenge / diagnostic / wrong-book`、`announcements`、`student exams / modules / growth`、`admin experiments / logs / knowledge-tree`、`school directories`、`files` 与 `library detail / shared library` 等入口。

## 2. 先看哪份文档

| 你要解决的问题 | 先看 | 再看 |
| --- | --- | --- |
| 想快速知道项目现在到哪一步、接下来先做什么 | `docs/project-readiness-index.md` | `docs/development-checklist.md` |
| 想确认 P0 到底还差哪些阻断项 | `docs/p0-productization-checklist.md` | `docs/p0-optimization-task-cards.md` |
| 想查 JSON / DB / 对象存储边界 | `docs/runtime-state-inventory.md` | `db/schema.sql`、`scripts/migrate-p0-runtime-state-to-db.mjs` |
| 想查严格测试门、CI、smoke 范围 | `docs/strict-testing-baseline.md` | `tests/browser/smoke.spec.ts`、`.github/workflows/ci.yml` |
| 想查 staging / production 发布、回滚、远端 smoke | `docs/staging-production-release-runbook.md` | `.github/workflows/release-smoke.yml` |
| 想把 P0 工作拆成 issue / task card | `docs/p0-optimization-task-cards.md` | `docs/development-checklist.md` |
| 想本地启动、看账号、看总功能说明 | `README.md` | 本索引页 |

建议查阅顺序：

1. 先看本页确认当前状态。
2. 再看 `docs/development-checklist.md` 理解优先级和硬规则。
3. 最后按任务类型跳转到测试、运行时状态或发布 runbook。

## 3. 当前判断

当前最强的三点：

- 多角色业务闭环已经完整，学生、教师、家长、学校、管理端都不是孤立演示页。
- 工程底座已经具备 `verify:strict`、CI production-like regression（含 browser smoke）、远端 smoke、DB-only guardrails 等可信基线。
- 关键高密度页面开始从“单页堆逻辑”转向“状态层 / 请求层 / 展示层”拆分，可维护性在变好。

当前最大的四个风险：

- 虽然当前工作树 `23` 个 `data/*.json` 都已具备 DB canonical path，且 production-like browser 已暂时清空 JSON fallback 告警名单，但低频 fallback 仍需继续巡检，避免长尾状态重新滑回文件主路径。
- 浏览器 smoke 目前只有 `20` 条关键路径，对整个项目规模而言覆盖仍偏薄。
- 仍有几个超大 hook / 工作台文件是后续维护热点，复杂改动时回归成本高。
- 文档虽然已经成体系，但如果不统一入口和同步指标，后续很容易继续漂移。

## 4. 当前优先处理项

### 运行时状态与存储

- 学校排课栈（课表、教师规则、禁排时段、模板、课前任务关联、AI 预演 / 回滚）已经具备 DB canonical path。
- 学校排课接口已经补到路由级单测，覆盖查询、创建、AI 预演、预演应用、回滚关键入口。
- 远端 / production-like smoke 已补入管理员课表只读基线，确认部署后仍可登录管理员并读取学校课表概览。
- 学校排课 AI 预演 / 应用 / 回滚链路已经补入独立 production-like API 回归，可通过 `npm run test:school-schedules:production-like:local` 复现。
- 主干 CI 的 production-like regression job 已顺序执行 `test:smoke:production-like`、`test:browser:production-like` 与 `test:school-schedules:production-like`，避免 production-like 浏览器回归与排课深回归只停留在本地命令。
- 浏览器 smoke 已补入公开账号恢复请求提交链路，确保恢复入口、受理态与工单元信息不会悄悄回归。
- 浏览器 smoke 已补入管理员异常登录后的安全告警通知链路，确认失败尝试后的成功登录会稳定生成可见提醒。
- 浏览器 smoke 已补入登录锁定链路，确认连续错误密码会进入锁定态，且锁定期间正确密码也不会被错误放行。
- 浏览器 smoke 已补入学生考试提交闭环，确认教师定向发布考试后，学生可完成作答、提交并在列表中看到已提交状态。
- 浏览器 smoke 已补入学生作业附件上传与教师批改页读取 / 下载闭环，确认对象存储内容能跨学生提交与教师批改两端稳定复用。
- 浏览器 smoke 已补入教师课程资料上传并由学生在课程文件中心访问 / 下载闭环，确认班级资料能跨教师上传端与学生学习端稳定复用。
- 浏览器 smoke 已补入教师发布公告并由学生查看闭环，确认班级公告能跨教师发布端与学生查看端稳定同步。
- 浏览器 smoke 已补入教师发布公告并由家长查看闭环，确认班级公告能触达学生绑定家长而不依赖手工刷新或角色切换后的旧缓存。
- 浏览器 smoke 已补入教师发起站内会话、学生查看并回复、教师再读到回复闭环，确认 `inbox` 的会话列表、详情读取与回复刷新能跨角色稳定同步。
- 浏览器 smoke 已补入教师抄送家长的站内会话、家长查看并回复、教师再读到回复闭环，确认 `inbox` 的 `includeParents` 分发能力与家长侧回复链路稳定可用。
- 浏览器 smoke 已补入管理员恢复工单后台处理闭环，确认搜索、接单、step-up 与标记已解决都能串通。
- 浏览器 smoke 已补入资料库文件上传 / 下载 / 分享闭环，确认对象存储内容可经管理端导入、详情页下载与公开分享页复用。
- 浏览器 smoke 已补入学校管理员排课 AI 预演 / 应用 / 回滚闭环，并顺手修复排课页刷新口径，避免写入后继续显示旧课表统计。
- 浏览器 smoke 已补入学校管理员组织边界隔离，确认本校班级清单与显式跨校 `schoolId` 访问都被稳定收口。
- AI eval gate 已补齐 `ai_eval_gate_runtime` / `ai_eval_gate_runs` 两张表与 DB canonical path，最新 production-like browser 回归里 `ai-eval-gate-config.json` / `ai-eval-gate-history.json` 已不再触发 runtime fallback 警告。
- Student personas 已补齐 `student_personas` 表与 DB canonical path，最新 production-like browser 回归里也不再触发 `student-personas.json` fallback 警告。
- 对当前工作树里 `23` 个已具备 DB canonical path 的 JSON 文件，固定执行策略：
  - 生产态以 DB 为准
  - JSON 只保留给本地 seed、导入包或 demo fallback
  - 文件内容类继续走“DB 元数据 + 对象存储内容”拆分
- 下一步优先补：
  - 其余对象存储读写链路浏览器回归
  - production-like 浏览器回归的稳定性维护与失败排查路径
  - 低频 fallback 的持续巡检与防回退

### 浏览器回归

- 保持当前 `20` 条 smoke 一直可用：
  - 学生进入执行优先首页
  - 教师发布作业
  - 家长提交行动回执
  - 用户提交账号恢复请求
  - 管理员异常登录后收到安全告警通知
  - 用户连续登录失败后被临时锁定
  - 学生完成老师发布考试并提交
  - 学生上传作业附件并由教师在批改页读取 / 下载
  - 教师上传课程资料并由学生在课程文件中心访问 / 下载
  - 教师发布公告并由学生查看
  - 教师发布公告并由家长查看
  - 教师发起站内会话并由学生回复
  - 教师抄送家长的站内会话并由家长回复
  - 教师上传模块资源并由学生在模块详情页访问 / 下载
  - 管理员在工单台接单并解决恢复请求
  - 管理员完成资料库文件上传、下载与分享
  - 学校管理员排课 AI 预演 / 应用 / 回滚
  - 学校管理员组织边界隔离
  - 管理员高风险操作 step-up
  - 教师会话无法越权访问 admin API
- 下一轮优先扩这几类：
  - 其余对象存储读写链路
  - 页级 hook 状态迁移定向单测

### 前端维护热点

- 当前最大前端逻辑热点：
  - `app/school/schedules/useSchoolSchedulesPage.ts`
  - `app/practice/usePracticePage.ts`
  - `app/admin/ai-models/useAdminAiModelsPage.ts`
  - `app/tutor/useTutorPage.ts`
  - `app/teacher/notifications/useTeacherNotificationRulesPage.ts`
  - `app/wrong-book/useWrongBookPage.ts`
- 页面层直接发请求的首批收口已经覆盖：
  - `app/admin/experiments/page.tsx`
  - `app/admin/knowledge-tree/page.tsx`
  - `app/admin/logs/page.tsx`
  - `app/admin/register/page.tsx`
  - `app/announcements/page.tsx`
  - `app/challenge/page.tsx`
  - `app/diagnostic/page.tsx`
  - `app/focus/page.tsx`
  - `app/files/page.tsx`
  - `app/library/[id]/page.tsx`
  - `app/library/shared/[token]/page.tsx`
  - `app/login/page.tsx`
  - `app/recover/page.tsx`
  - `app/register/page.tsx`
  - `app/school/classes/page.tsx`
  - `app/school/register/page.tsx`
  - `app/school/students/page.tsx`
  - `app/school/teachers/page.tsx`
  - `app/student/exams/page.tsx`
  - `app/student/growth/page.tsx`
  - `app/student/modules/page.tsx`
  - `app/teacher/register/page.tsx`
- 当前 `app/**/page.tsx` 直接请求清单已经清空；`library` 主工作台已拆成 `useLibraryPage.ts` + `useLibraryPageState.ts` + `useLibraryPageEffects.ts` + `useLibraryPageLoaders.ts` + `useLibraryPageActions.ts`，`practice` 主工作台已拆成 `usePracticePage.ts` + `usePracticeQuestionSupport.ts`，`school schedules` 主工作台也已拆成 `useSchoolSchedulesPage.ts` + `useSchoolSchedulesManualActions.ts` + `useSchoolSchedulesAiActions.ts` + `useSchoolSchedulesConstraintActions.ts`，且 `useSchoolSchedulesConstraintActions.ts` 已继续拆成 `useSchoolSchedulesTemplateActions.ts` + `useSchoolSchedulesTeacherRuleActions.ts` + `useSchoolSchedulesTeacherUnavailableActions.ts`，`admin questions` 已进一步拆成 `useAdminQuestionsPage.ts` + `useAdminQuestionsPageState.ts` + `useAdminQuestionsPageEffects.ts` + `useAdminQuestionsPageLoaders.ts` + `useAdminQuestionsToolActions.ts` + `useAdminQuestionsListActions.ts`，`admin ai models` 也已拆成 `useAdminAiModelsPage.ts` + `useAdminAiModelsActions.ts` + `useAdminAiModelsRoutingActions.ts` + `useAdminAiModelsEvaluationActions.ts`，`admin knowledge points` 已拆成 `useAdminKnowledgePointsPage.ts` + `useAdminKnowledgePointsPageState.ts` + `useAdminKnowledgePointsPageEffects.ts` + `useAdminKnowledgePointsLoaders.ts` + `useAdminKnowledgePointsActions.ts`，`teacher assignment detail` 已进一步拆成 `useTeacherAssignmentDetailPage.ts` + `useTeacherAssignmentDetailPageState.ts` + `useTeacherAssignmentDetailPageEffects.ts` + `useTeacherAssignmentDetailLoaders.ts` + `useTeacherAssignmentDetailActions.ts`，`teacher assignment review` 已拆成 `useTeacherAssignmentReviewPage.ts` + `useTeacherAssignmentReviewPageState.ts` + `useTeacherAssignmentReviewPageActions.ts`，`teacher exam detail` 已进一步拆成 `useTeacherExamDetailPage.ts` + `useTeacherExamDetailPageState.ts` + `useTeacherExamDetailPageEffects.ts` + `useTeacherExamDetailPageActions.ts`，`teacher exam create` 已拆成 `useTeacherExamCreatePage.ts` + `useTeacherExamCreatePageLoaders.ts` + `useTeacherExamCreatePageActions.ts`，`student dashboard` 已拆成 `useStudentDashboardPage.ts` + `useStudentDashboardPageState.ts` + `useStudentDashboardPageEffects.ts` + `useStudentDashboardLoaders.ts` + `useStudentDashboardActions.ts`，`student portrait` 已拆成 `useStudentPortraitPage.ts` + `useStudentPortraitPageState.ts` + `useStudentPortraitPageEffects.ts` + `useStudentPortraitPageLoaders.ts`，`report` 已拆成 `useReportPage.ts` + `useReportPageState.ts` + `useReportPageEffects.ts` + `useReportPageLoaders.ts`，`student favorites` 已拆成 `useStudentFavoritesPage.ts` + `useStudentFavoritesLoaders.ts` + `useStudentFavoritesActions.ts`，`student profile` 已拆成 `useStudentProfilePage.ts` + `useStudentProfileLoaders.ts` + `useStudentProfileActions.ts`，`announcements` 已拆成 `useAnnouncementsPage.ts` + `useAnnouncementsLoaders.ts` + `useAnnouncementsActions.ts`，`notifications` 已拆成 `useNotificationsPage.ts` + `useNotificationsLoaders.ts` + `useNotificationsActions.ts`，`teacher ai tools` 已拆成 `useTeacherAiToolsPage.ts` + `useTeacherAiToolsPageState.ts` + `useTeacherAiToolsLoaders.ts` + `useTeacherAiToolsPaperActions.ts` + `useTeacherAiToolsWorkflowActions.ts`，`teacher modules` 已进一步拆成 `useTeacherModulesPage.ts` + `useTeacherModulesPageState.ts` + `useTeacherModulesPageEffects.ts` + `useTeacherModulesLoaders.ts` + `useTeacherModulesActions.ts`，`teacher notifications` 已拆成 `useTeacherNotificationRulesPage.ts` + `useTeacherNotificationRulesLoaders.ts` + `useTeacherNotificationRulesActions.ts`，`teacher analysis` 已进一步拆成 `useTeacherAnalysisPage.ts` + `useTeacherAnalysisPageState.ts` + `useTeacherAnalysisPageEffects.ts` + `useTeacherAnalysisLoaders.ts` + `useTeacherAnalysisActions.ts`，`teacher seating` 已拆成 `useTeacherSeatingPage.ts` + `useTeacherSeatingPageState.ts` + `useTeacherSeatingLoaders.ts` + `useTeacherSeatingActions.ts`，`discussions` 已拆成 `useDiscussionsPage.ts` + `useDiscussionsPageState.ts` + `useDiscussionsLoaders.ts` + `useDiscussionsActions.ts`，`student exam detail` 已拆成 `useStudentExamDetailPage.ts` + `useStudentExamDetailPageState.ts` + `useStudentExamDetailPageEffects.ts` + `useStudentExamDetailLoaders.ts` + `useStudentExamDetailSubmissionActions.ts` + `useStudentExamDetailActions.ts`，`student assignment detail` 已拆成 `useStudentAssignmentDetailPage.ts` + `useStudentAssignmentDetailLoaders.ts` + `useStudentAssignmentDetailActions.ts`，`inbox` 已拆成 `useInboxPage.ts` + `useInboxPageState.ts` + `useInboxLoaders.ts` + `useInboxActions.ts`，`teacher dashboard` 已拆成 `useTeacherDashboardPage.ts` + `useTeacherDashboardPageState.ts` + `useTeacherDashboardClassActions.ts` + `useTeacherDashboardWorkflowActions.ts`，`wrong-book` 已拆成 `useWrongBookPage.ts` + `useWrongBookLoaders.ts` + `useWrongBookActions.ts`，`tutor` 已拆成 `useTutorPage.ts` + `useTutorPageState.ts` + `useTutorPageActions.ts` + `tutorPageUtils.ts`，`parent` 已拆成 `useParentPage.ts` + `useParentPageLoaders.ts` + `useParentPageActions.ts`，`library detail` 已拆成 `useLibraryDetailPage.ts` + `useLibraryDetailPageLoaders.ts` + `useLibraryDetailPageActions.ts`，`files` 已拆成 `useFilesPage.ts` + `useFilesPageLoaders.ts` + `useFilesPageActions.ts`，`course` 已拆成 `useCoursePage.ts` + `useCoursePageLoaders.ts` + `useCoursePageActions.ts`，`account-recovery` 也已拆成 `account-recovery.ts` + `account-recovery-shared.ts` + `account-recovery-attempts.ts`。本轮已补上 `admin questions`、`admin ai models`、`admin knowledge points`、`teacher assignment detail`、`teacher assignment review`、`teacher exam detail`、`teacher exam create`、`student dashboard`、`student portrait`、`report`、`student favorites`、`student profile`、`announcements`、`notifications`、`library`、`library detail`、`school schedules`、`teacher ai tools`、`teacher modules`、`teacher notifications`、`teacher analysis`、`teacher seating`、`discussions`、`student exam detail`、`student assignment detail`、`inbox`、`teacher dashboard`、`wrong-book`、`tutor`、`parent`、`files`、`course` 与 `account-recovery` 共享层的纯函数单测，下一批前端维护重点转向：
  - `teacher exam create` 现已进一步补成 `useTeacherExamCreatePage.ts` + `useTeacherExamCreatePageState.ts` + `useTeacherExamCreatePageEffects.ts` + `useTeacherExamCreatePageLoaders.ts` + `useTeacherExamCreatePageActions.ts`
  - `school schedules / practice / admin ai models / tutor / teacher notifications / wrong-book / teacher submissions / parent` 等仍偏重的工作台治理
  - 生产态对象存储链路的浏览器回归扩充
  - 拆层后接口边界的继续收敛

## 5. 文档维护约定

- 只要页面、API、单测、smoke、`data/*.json` 数量发生明显变化，就同步更新本页快照。
- 提交前执行 `npm run check:project-snapshot`，先确认当前快照文档与仓库事实一致。
- 只要 P0 阻断项状态变化，就同步更新 `docs/p0-productization-checklist.md`。
- 只要发布路径、质量门、远端 smoke 发生变化，就同步更新 `docs/strict-testing-baseline.md` 与 `docs/staging-production-release-runbook.md`。
- 若新增周度 checklist 或专项 runbook，务必把入口补到 README 的“运营与治理文档索引”里。
