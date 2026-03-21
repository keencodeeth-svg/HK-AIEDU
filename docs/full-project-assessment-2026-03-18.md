# HK-AI-EDU 全项目评估

更新时间：2026-03-20

适用范围：基于当前仓库代码、现有文档、严格测试基线，以及本轮补充复核结果，对项目的技术、产品逻辑、用户体验、UI 系统、安全、测试与运维成熟度做一次内部审计式评估。

## 1. 总体判断

- 当前阶段不是 demo，也不再是早期 MVP；它已经是一个具备多角色业务闭环、可进入受控试点的 beta 产品。
- 当前阶段仍不是可规模复制的 release candidate。主要阻力不在“有没有功能”，而在“复杂度控制、测试可重复性、长尾运行态治理、重工作台体验收口”。
- 如果目标是 `单校/少量学校试点`，当前项目是可推进的。
- 如果目标是 `多学校并发扩张 + 更重运营依赖 + 更高稳定性承诺`，当前项目还需要一轮工程与产品化收口。

建议定级：

- 试点就绪度：`高`
- 规模化发布就绪度：`中`
- 安全成熟度：`中高`
- 维护成熟度：`中`

## 2. 维度评分

评分规则：`10` 分为满分，`6` 分表示“可用但风险明显”，`8` 分表示“已经超过原型期，有稳定基础但仍有结构性短板”。

| 维度 | 评分 | 结论 |
| --- | --- | --- |
| 技术架构 | 8/10 | API 分层、统一响应、运行时护栏、DB/对象存储路径已成体系，明显高于一般原型。 |
| 安全 | 8/10 | 租户边界、登录锁定、step-up、高风险管理端保护、readiness 授权都已具备。 |
| 测试与质量门 | 8/10 | 已有 `verify:strict`、browser smoke、production-like regression、CI 汇总门，基线扎实。 |
| 发布与运维 | 7/10 | 可观测性和运行时治理已起步，但外部接警与默认运维流程仍不够完整。 |
| 产品逻辑 | 8/10 | 学生、教师、家长、学校、管理端都有真实业务链路，不是孤立页面拼接。 |
| 用户体验 | 7/10 | 首页和主工作台明显做了 Action-first 收口，但重工作台仍偏密，学习成本较高。 |
| UI 系统 | 8/10 | 设计语言统一、角色导航和移动端适配明确，不是无辨识度模板站。 |
| 可维护性 | 6/10 | 少数超大 hook / 页面已成为主要风险源，后续需求叠加成本会快速上升。 |

## 3. 最高优先级发现

### S1. 审计时发现本地 production-like 排课深回归不可重复执行，已在当日修复为默认隔离数据库

这是本轮最重要的新证据。问题本质不是排课主逻辑失效，而是 `本地 production-like 测试环境不具备幂等复跑能力`。

修复进展：

- `scripts/run-production-like-smoke-local.sh` 已改为默认创建隔离临时数据库，不再默认复用 `hk_aiedu_local`
- 修复后连续两次执行 `npm run test:school-schedules:production-like:local` 均通过，并在结束后自动回收隔离数据库

证据：

- `scripts/run-production-like-smoke-local.sh` 默认固定使用 `hk_aiedu_local` 数据库，并在执行时只做 `build -> db:migrate -> seed:base -> seed:stage3 -> security:migrate-passwords -> 测试`，没有清库步骤。
- `scripts/init-db.mjs` 只执行 schema 初始化，不做 `drop / truncate / reset`。
- 在复用既有本地数据库的情况下，`npm run test:school-schedules:production-like:local` 失败，报错为 `POST /api/school/schedules for lock seed failed`，返回 `409`，消息为 `班级节次时间冲突`。
- 同一台机器上切换到一个全新的数据库 `hk_aiedu_audit_20260318` 后，`PRODUCTION_LIKE_DB_NAME=hk_aiedu_audit_20260318 npm run test:school-schedules:production-like:local` 通过。
- 进一步查询本地复用库时，已经存在一条与回归用例完全同构的课表记录：`weekday=4`、`17:00-17:40`、`room=锁定教室A`、`campus=模板校区`、`locked=true`。而 `scripts/seed-stage3.mjs` 并不会写入这类排课记录，说明这条数据来自此前测试残留。

影响：

- 会降低本地 production-like 回归的可信度。
- 开发者无法快速判断是业务真回归，还是测试库脏数据导致的假失败。
- 它不会直接否定线上发布质量门，因为 CI 使用的是全新 PostgreSQL service，但会显著影响本地复现效率和排障速度。

建议：

1. 让 `scripts/run-production-like-smoke-local.sh` 默认使用“每次唯一数据库名”，或在执行前显式清空目标库。
2. 给本地 production-like 脚本增加 `reset-db` 选项，确保重复执行稳定一致。
3. 把“复用旧库可能产生假红灯”的限制写进 `docs/strict-testing-baseline.md` 与 runbook。

### S1. 超大 hook / 页面集中，后续维护成本和回归半径过大

目前最显著的可维护性风险已经从“无结构”变成“少数热点文件过重”。

高风险文件体量：

- `app/school/schedules/useSchoolSchedulesPage.ts`: `652` 行
- `app/practice/usePracticePage.ts`: `584` 行
- `app/admin/ai-models/useAdminAiModelsPage.ts`: `569` 行
- `app/tutor/useTutorPage.ts`: `379` 行
- `app/teacher/notifications/useTeacherNotificationRulesPage.ts`: `229` 行
- `app/wrong-book/useWrongBookPage.ts`: `221` 行
- `app/teacher/submissions/useTeacherSubmissionsPage.ts`: `217` 行
- `app/parent/useParentPage.ts`: `217` 行

最新进展：

- `app/library/useLibraryPage.ts` 已从 `330` 行继续拆到 `130` 行，并把页面本地状态 / refs 同步抽到 `useLibraryPageState.ts`（`306` 行），把首屏加载、筛选刷新和教师班级同步副作用抽到 `useLibraryPageEffects.ts`（`38` 行）；资料筛选派生、教材导入表单约束、学科分组和展开态修剪逻辑已提成纯函数并扩展到既有单测。
- `app/teacher/assignments/[id]/reviews/[studentId]/useTeacherAssignmentReviewPage.ts` 已从 `287` 行拆到 `82` 行，并把本地表单状态与请求 ref 抽到 `useTeacherAssignmentReviewPageState.ts`（`138` 行），把加载 / AI 批改 / 保存动作抽到 `useTeacherAssignmentReviewPageActions.ts`（`265` 行）；批改模式派生、已存批改状态回填与保存 payload 拼装逻辑已提成纯函数并补齐单测。
- `app/practice/usePracticePage.ts` 已从 `909` 行拆到 `584` 行，并把收藏 / AI 讲解 / 变式训练支持层抽到 `app/practice/usePracticeQuestionSupport.ts`（`336` 行）。
- `app/school/schedules/useSchoolSchedulesPage.ts` 已从 `1249` 行拆到 `652` 行，并把人工排课、AI 排课、模板 / 教师约束动作分别抽到 `useSchoolSchedulesManualActions.ts`（`363` 行）、`useSchoolSchedulesAiActions.ts`（`223` 行）和 `useSchoolSchedulesConstraintActions.ts`（`480` 行）。
- `app/admin/ai-models/useAdminAiModelsPage.ts` 已从 `980` 行拆到 `569` 行；动作层又进一步拆成 `useAdminAiModelsActions.ts`（`158` 行）+ `useAdminAiModelsRoutingActions.ts`（`345` 行）+ `useAdminAiModelsEvaluationActions.ts`（`391` 行）。
- `app/teacher/useTeacherDashboardPage.ts` 已从 `717` 行拆到 `129` 行，并把班级 / 作业动作抽到 `useTeacherDashboardClassActions.ts`（`392` 行），把预警 / 审批动作抽到 `useTeacherDashboardWorkflowActions.ts`（`249` 行），再把本地状态与 ref 同步抽到 `useTeacherDashboardPageState.ts`（`205` 行）；知识点筛选、待审批入班、活跃预警、缺作业班级、临近截止作业与 dashboard 数据判定逻辑已提成纯函数并补齐单测。
- `app/teacher/modules/useTeacherModulesPage.ts` 已从 `710` 行继续拆到 `128` 行，并把本地状态 / refs 同步抽到 `useTeacherModulesPageState.ts`（`210` 行），把首屏加载、班级切换与模块资源刷新副作用抽到 `useTeacherModulesPageEffects.ts`（`58` 行），原有读取链路继续保留在 `useTeacherModulesLoaders.ts`（`344` 行），创建模块 / 上传资源 / 删除资源 / 排序动作继续保留在 `useTeacherModulesActions.ts`（`350` 行）；父模块选择校正逻辑已提成纯函数并扩展到既有单测。
- `app/teacher/notifications/useTeacherNotificationRulesPage.ts` 已从 `682` 行拆到 `229` 行，并把加载链路抽到 `useTeacherNotificationRulesLoaders.ts`（`306` 行），把班级切换 / 保存 / 预览 / 执行动作抽到 `useTeacherNotificationRulesActions.ts`（`446` 行）。
- `app/teacher/analysis/useTeacherAnalysisPage.ts` 已从 `587` 行继续拆到 `120` 行，并把本地状态与 request-id / skip refs 同步抽到 `useTeacherAnalysisPageState.ts`（`205` 行），把首屏加载、班级 / 学生切换和跨班报告清理副作用抽到 `useTeacherAnalysisPageEffects.ts`（`101` 行），原有读取链路继续保留在 `useTeacherAnalysisLoaders.ts`（`388` 行），预警确认 / 动作执行 / 报告生成动作继续保留在 `useTeacherAnalysisActions.ts`（`234` 行）；热力图裁剪、骨架态、活跃预警数和最弱知识点派生逻辑已提成纯函数并扩展到既有单测。
- `app/teacher/seating/useTeacherSeatingPage.ts` 已从 `557` 行拆到 `148` 行，并把本地状态与 ref 同步抽到 `useTeacherSeatingPageState.ts`（`223` 行），把加载链路保留在 `useTeacherSeatingLoaders.ts`（`161` 行），把 AI 预览 / 保存 / 跟进动作保留在 `useTeacherSeatingActions.ts`（`322` 行）；锁定座位、排座草稿编辑、观察清单与学期状态派生逻辑已提成纯函数并补齐单测。
- `app/school/schedules/useSchoolSchedulesConstraintActions.ts` 已从 `475` 行拆到 `109` 行，并把模板动作抽到 `useSchoolSchedulesTemplateActions.ts`（`250` 行），把教师规则动作抽到 `useSchoolSchedulesTeacherRuleActions.ts`（`211` 行），把教师禁排动作抽到 `useSchoolSchedulesTeacherUnavailableActions.ts`（`136` 行）；`school schedules` 约束层已经从单个高密度动作文件转成三块可独立维护的动作域。
- `app/student/exams/[id]/useStudentExamDetailActions.ts` 已从 `559` 行拆到 `126` 行，并把加载链路抽到 `useStudentExamDetailLoaders.ts`（`284` 行），把保存 / 提交流程抽到 `useStudentExamDetailSubmissionActions.ts`（`324` 行）；对应的自动保存合并与提交结果回写逻辑已提成纯函数并补齐单测。
- `app/student/exams/[id]/useStudentExamDetailPage.ts` 已从 `368` 行拆到 `141` 行，并把本地状态与 local draft 读写抽到 `useStudentExamDetailPageState.ts`（`168` 行），把断网 / 自动保存 / 防作弊 / 超时提交等页面副作用抽到 `useStudentExamDetailPageEffects.ts`（`172` 行）；作答统计、计时锁定、结果区反馈和 stage copy 派生逻辑已提成纯函数并扩展到既有单测。
- `app/admin/knowledge-points/useAdminKnowledgePointsPage.ts` 已从 `282` 行继续拆到 `127` 行，并把本地状态 / refs 同步抽到 `useAdminKnowledgePointsPageState.ts`（`261` 行），把首屏加载与列表刷新副作用抽到 `useAdminKnowledgePointsPageEffects.ts`（`30` 行）；AI 章节回退、load error 合流、页码范围与批量导入前的页面派生逻辑已提成纯函数并扩展到既有单测。
- `app/teacher/assignments/[id]/useTeacherAssignmentDetailPage.ts` 已从 `524` 行继续拆到 `111` 行，并把本地状态与 request-id / snapshot refs 同步抽到 `useTeacherAssignmentDetailPageState.ts`（`144` 行），把首屏加载副作用抽到 `useTeacherAssignmentDetailPageEffects.ts`（`15` 行），原有读取链路继续保留在 `useTeacherAssignmentDetailLoaders.ts`（`205` 行），提醒发送、rubric 编辑 / 保存和学生筛选清理动作继续保留在 `useTeacherAssignmentDetailActions.ts`（`255` 行）；作业逾期判定、完成率、均分、提醒预览和学生名单派生逻辑已提成纯函数并扩展到既有单测。
- `app/teacher/exams/[id]/useTeacherExamDetailPage.ts` 已从 `243` 行拆到 `60` 行，并把本地状态与快照 / request-id refs 同步抽到 `useTeacherExamDetailPageState.ts`（`81` 行），把首屏加载副作用抽到 `useTeacherExamDetailPageEffects.ts`（`15` 行），把加载 / 状态切换 / 复盘发布动作抽到 `useTeacherExamDetailPageActions.ts`（`231` 行）；学生风险排序、总分汇总、截止时间文案、加载时间文案和复盘发布反馈逻辑已提成纯函数并扩展到既有单测。
- `app/teacher/exams/create/useTeacherExamCreatePage.ts` 已从 `514` 行拆到 `105` 行，并把本地状态与 form / knowledge-point refs 同步抽到 `useTeacherExamCreatePageState.ts`（`105` 行），把首屏加载、班级切换与 ref 镜像副作用抽到 `useTeacherExamCreatePageEffects.ts`（`43` 行），原有配置 / 学生读取链路继续保留在 `useTeacherExamCreatePageLoaders.ts`（`290` 行），提交流程继续保留在 `useTeacherExamCreatePageActions.ts`（`136` 行）；班级/知识点配置同步、目标学生裁剪、提交流程 payload、页面派生状态与刷新时间文案逻辑已提成纯函数并补齐单测。
- `app/student/useStudentDashboardPage.ts` 已从 `501` 行拆到 `144` 行，并把控制台读取链路保留在 `useStudentDashboardLoaders.ts`（`324` 行），把计划刷新 / 加班级 / 埋点动作保留在 `useStudentDashboardActions.ts`（`217` 行），再把 request-id refs、本地状态与 guide 卡片控制抽到 `useStudentDashboardPageState.ts`（`170` 行），把首屏加载、guide 可见性、分类切换与任务曝光副作用抽到 `useStudentDashboardPageEffects.ts`（`67` 行）；优先任务聚合、入口可见性、任务曝光 payload 与 join success 文案逻辑已提成纯函数并补齐单测，同时保留 dashboard / schedule / radar / today-tasks 多请求的 latest-request-wins 保护。
- `app/student/portrait/useStudentPortraitPage.ts` 已从 `237` 行拆到 `62` 行，并把本地状态与 request-id / snapshot refs 同步抽到 `useStudentPortraitPageState.ts`（`80` 行），把首屏加载副作用抽到 `useStudentPortraitPageEffects.ts`（`13` 行），把画像读取链路抽到 `useStudentPortraitPageLoaders.ts`（`97` 行）；画像阶段文案、优先动作建议、Tutor 复用入口与总览 CTA 派生逻辑已提成纯函数并扩展到既有单测。
- `app/report/useReportPage.ts` 已从 `229` 行拆到 `60` 行，并把页面状态与 snapshot / request-id ref 同步抽到 `useReportPageState.ts`（`97` 行），把周报 / 画像并发读取链路抽到 `useReportPageLoaders.ts`（`164` 行），把首屏加载、埋点与筛选回退副作用抽到 `useReportPageEffects.ts`（`65` 行）；画像筛选、章节选项、过滤回退与热力图分组派生逻辑已提成纯函数并扩展到既有单测。
- `app/student/favorites/useStudentFavoritesPage.ts` 已从 `359` 行拆到 `210` 行，并把收藏夹读取链路抽到 `useStudentFavoritesLoaders.ts`（`145` 行），把保存 / 移除 / 复制动作抽到 `useStudentFavoritesActions.ts`（`168` 行）；学科选项、标签排序、筛选结果和本地快照回写逻辑已提成纯函数并补齐单测。
- `app/student/profile/useStudentProfilePage.ts` 已从 `336` 行拆到 `164` 行，并把资料 / 绑定码读取链路抽到 `useStudentProfileLoaders.ts`（`185` 行），把保存 / 复制 / 刷新 / 重置绑定码动作抽到 `useStudentProfileActions.ts`（`203` 行）；初始表单、学科切换、保存反馈和资料回写逻辑已提成纯函数并补齐单测。
- `app/announcements/useAnnouncementsPage.ts` 已从 `362` 行拆到 `164` 行，并把公告初始化 / 刷新链路抽到 `useAnnouncementsLoaders.ts`（`256` 行），把发布 / 教师班级切换 / 成功提示动作抽到 `useAnnouncementsActions.ts`（`108` 行）；发布 payload、发布后反馈和页面数据判定逻辑已提成纯函数并补齐单测。
- `app/notifications/useNotificationsPage.ts` 已从 `318` 行拆到 `146` 行，并把通知读取 / 刷新链路抽到 `useNotificationsLoaders.ts`（`133` 行），把单条已读 / 批量已读动作抽到 `useNotificationsActions.ts`（`202` 行）；筛选、已读计数、类型选项和本地已读回写逻辑已提成纯函数并补齐单测。
- `app/discussions/useDiscussionsPage.ts` 已从 `314` 行拆到 `136` 行，并把状态与 ref 同步抽到 `useDiscussionsPageState.ts`（`258` 行），把会话 / 列表 / 详情读取保留在 `useDiscussionsLoaders.ts`（`406` 行），把发布 / 回复 / 选班 / 选题动作保留在 `useDiscussionsActions.ts`（`279` 行）；stage copy、话题筛选和页面派生状态逻辑已提成纯函数并补齐单测。
- `app/inbox/useInboxPage.ts` 已从 `313` 行拆到 `137` 行，并把状态与 ref 同步抽到 `useInboxPageState.ts`（`263` 行），把会话 / 列表 / 详情读取保留在 `useInboxLoaders.ts`（`340` 行），把建会话 / 回复 / 选会话动作保留在 `useInboxActions.ts`（`240` 行）；当前会话、未读统计、筛选结果和 URL 目标线程匹配逻辑已提成纯函数并补齐单测。
- `app/teacher/ai-tools/useTeacherAiToolsPage.ts` 已从 `485` 行拆到 `146` 行，并把本地状态与 ref 同步抽到 `useTeacherAiToolsPageState.ts`（`351` 行），把 bootstrap 读取链路保留在 `useTeacherAiToolsLoaders.ts`（`150` 行），把组卷与重试动作收敛到 `useTeacherAiToolsPaperActions.ts`（`135` 行），把讲稿 / 讲评包 / 下发 / 纠错链路保留在 `useTeacherAiToolsWorkflowActions.ts`（`460` 行）；表单 scope reset、班级切换恢复、知识点裁剪和 question-check preview 派生逻辑已提成纯函数并扩展到既有单测。
- `app/admin/questions/useAdminQuestionsPage.ts` 已从 `390` 行继续拆到 `143` 行，并把本地状态与 request-id / query refs 同步抽到 `useAdminQuestionsPageState.ts`（`152` 行），把首屏拉取、查询分页刷新与表单知识点回填副作用抽到 `useAdminQuestionsPageEffects.ts`（`101` 行），原有知识点 / 题库读取链路继续保留在 `useAdminQuestionsPageLoaders.ts`（`217` 行），工具与列表动作继续保留在 `useAdminQuestionsToolActions.ts`（`250` 行）和 `useAdminQuestionsListActions.ts`（`205` 行）；知识点过滤、章节选项、分页范围、load error 合流和表单同步逻辑已提成纯函数并扩展到既有单测。
- `app/wrong-book/useWrongBookPage.ts` 已从 `479` 行拆到 `221` 行，并把并发加载链路抽到 `useWrongBookLoaders.ts`（`231` 行），把创建任务 / 完成任务 / 复练提交流程抽到 `useWrongBookActions.ts`（`258` 行）；默认截止日期、选题裁剪、busy/content 判定与刷新反馈文案逻辑已提成纯函数并补齐单测。
- `app/student/assignments/[id]/useStudentAssignmentDetailPage.ts` 已从 `463` 行拆到 `166` 行，并把读取链路抽到 `useStudentAssignmentDetailLoaders.ts`（`310` 行），把上传 / 删除上传 / 提交流程抽到 `useStudentAssignmentDetailActions.ts`（`209` 行）；反馈加载判定、快照提示、提交回写和可提交状态派生逻辑已提成纯函数并补齐单测。
- `app/tutor/useTutorPage.ts` 已从 `460` 行拆到 `379` 行，并把页面级本地状态抽到 `useTutorPageState.ts`（`46` 行），把页面动作编排继续收口到 `useTutorPageActions.ts`（`252` 行），并把历史回填、start-over 重置与模式标签派生提到 `tutorPageUtils.ts`（`79` 行）；对应单测已覆盖历史回填、重置默认值和 direct/study 模式标签解析。
- `app/parent/useParentPage.ts` 已从 `453` 行拆到 `217` 行，并把并发加载链路抽到 `useParentPageLoaders.ts`（`350` 行），把回执 / 复制动作抽到 `useParentPageActions.ts`（`125` 行）；订正任务分桶与家长提醒文案派生已提成纯函数并补齐单测。
- `app/library/[id]/useLibraryDetailPage.ts` 已从 `447` 行拆到 `196` 行，并把并发加载链路抽到 `useLibraryDetailPageLoaders.ts`（`267` 行），把标注 / 分享 / 知识点修正动作抽到 `useLibraryDetailPageActions.ts`（`243` 行）；知识点筛选、选区捕获与标注 payload 逻辑已提成纯函数并补齐单测。
- `app/files/useFilesPage.ts` 已从 `438` 行拆到 `211` 行，并把 bootstrap / 班级资料读取链路抽到 `useFilesPageLoaders.ts`（`293` 行），把上传 / 链接提交流程抽到 `useFilesPageActions.ts`（`165` 行）；按文件夹分组与班级失效后的回退逻辑已提成纯函数并补齐单测。
- `app/course/useCoursePage.ts` 已从 `401` 行拆到 `155` 行，并把 bootstrap / 课程详情读取链路抽到 `useCoursePageLoaders.ts`（`323` 行），把班级切换与课程大纲保存动作抽到 `useCoursePageActions.ts`（`147` 行）；syllabus 归一化、班级失效后的回退与提交类型文案逻辑已提成纯函数并补齐单测。
- `lib/account-recovery.ts` 已从 `893` 行拆到 `300` 行，并把工单映射 / SLA / 归一化逻辑抽到 `account-recovery-shared.ts`（`387` 行），把尝试记录 / 限流 / fallback 逻辑抽到 `account-recovery-attempts.ts`（`280` 行）；相关定向单测已同步更新模块 cache reset。
- 这意味着资料库领域复杂度仍然存在，但已经从“单个超大 hook”降为“状态层 + 动作层”分层结构，维护风险有所下降。
- `teacher exam create`、`student dashboard`、`student portrait`、`report`、`student favorites`、`student profile`、`announcements`、`notifications`、`discussions`、`inbox`、`teacher ai tools`、`teacher seating`、`admin questions`、`admin knowledge points`、`wrong-book`、`student assignment detail`、`student exam detail`、`teacher exam detail`、`teacher assignment review`、`teacher assignment detail`、`teacher modules`、`teacher analysis`、`tutor`、`parent`、`library`、`library detail`、`files`、`course` 与 `teacher dashboard` 都已经脱离“单个超大 hook 承载全部逻辑”的形态，当前剩余高密度热点进一步集中到 `school schedules`、`practice`、`admin ai models`、`tutor`、`teacher notifications`、`wrong-book`、`teacher submissions` 与 `parent` 这几块工作台，`teacher ai tools` 的剩余复杂度则主要沉积在 workflow actions 动作域。

影响：

- 改动局部需求时，极易触发大范围状态耦合。
- 评审、补测、回归成本都偏高。
- 这些热点文件恰好又落在学校排课、练习、模型治理、题库运营与考试执行等高价值路径上，风险不是“代码不好看”，而是“业务变更的事故半径变大”。

建议：

1. 优先给 `school schedules`、`practice`、`admin ai models`、`tutor`、`teacher notifications`、`wrong-book`、`teacher submissions`、`parent` 这批剩余热点补状态迁移单测，并继续压缩页面级编排层的体量和副作用密度。
2. 按 `请求层 / 状态聚合层 / 展示层 / 派生计算层` 做物理拆分，不再继续往原文件堆逻辑。
3. 每拆一个大 hook，就补一个面向状态迁移的定向单测，而不只依赖 `build`。

## 4. 高优先级发现

### S2. 运行时状态仍是“DB canonical path + JSON 残留”混合治理，长尾风险还在

当前文档与代码都说明项目已经进入 DB canonical path 阶段，但仓库下仍有 `23` 个 `data/*.json` 文件。

正面证据：

- `docs/project-readiness-index.md` 明确记录：当前 `23` 个 JSON 文件都已具备 DB canonical path。
- `lib/runtime-guardrails.ts` 与 `lib/storage.ts` 对高频状态、JSON fallback、生产态运行约束已经做了强限制。

残余风险：

- 治理策略已经明确，但“长尾文件不再悄悄回到运行时主路径”仍需要持续巡检。
- 当功能继续增长时，团队很容易在低频模块重新走回 JSON fallback 路线。

建议：

1. 对剩余 `23` 个 JSON 文件分层标记：`seed only`、`import pack only`、`fallback tolerated`、`必须下线`。
2. 把运行时日志里的 JSON fallback 告警转成固定巡检项。
3. 对新功能建立硬规则：新增运行态状态不得默认落 JSON。

### S2. 可观测性基础扎实，但默认接警与外部故障闭环还不够完整

现状并不弱，问题在于“已经有内核，但还没有完全运营化”。

正面证据：

- `lib/observability.ts` 已记录 API 请求日志、错误率、耗时、P95、近 24h 统计。
- `lib/observability-alerts.ts` 已有阈值、健康/告警/样本不足判定逻辑。
- `lib/error-tracker.ts` 已支持带 `traceId/requestId/user` 上下文的错误上报。

不足：

- 外部错误跟踪是可选项，`ERROR_TRACKING_WEBHOOK_URL` 不配置时默认关闭。
- 当前体系更像“可观测性能力已内建”，但还不是“默认接警、默认升级、默认可追责”的稳定运维系统。

建议：

1. 把错误跟踪与告警 webhook 接入变成 staging/prod 的默认部署要求，而不是可选增强。
2. 增加“最近 24h 无样本”与“错误持续高于阈值”的自动升级动作。
3. 将高价值路径的 `traceId` 串进发布回滚与客服排障手册。

### S2. 页面层仍存在请求、状态、展示未完全分离的入口

虽然主干高频工作台已经开始收口，但仍有若干页面保留“页面直接发请求”的旧模式。

审计时首批关注并已完成收口的例子：

- `app/teacher/register/page.tsx`
- `app/school/register/page.tsx`
- `app/admin/register/page.tsx`
- `app/focus/page.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/recover/page.tsx`
- `app/announcements/page.tsx`
- `app/challenge/page.tsx`
- `app/diagnostic/page.tsx`
- `app/files/page.tsx`
- `app/library/[id]/page.tsx`
- `app/wrong-book/page.tsx`
- `app/school/students/page.tsx`
- `app/school/teachers/page.tsx`
- `app/school/classes/page.tsx`
- `app/student/exams/page.tsx`
- `app/student/growth/page.tsx`
- `app/student/modules/page.tsx`
- `app/admin/logs/page.tsx`
- `app/admin/knowledge-tree/page.tsx`
- `app/library/shared/[token]/page.tsx`

修复进展：

- `app/admin/experiments/page.tsx` 已在当日迁移到 `useAdminExperimentsPage` / `useAdminExperimentsPageView` 模式，不再由页面组件直接承载请求与副作用
- `app/teacher/register/page.tsx`、`app/school/register/page.tsx`、`app/admin/register/page.tsx` 已在当日迁移到共享注册提交 hook，不再由页面组件直接处理注册请求与重定向
- `app/focus/page.tsx` 已在当日迁移到 `useFocusPage` / `useFocusPageView` 模式，latest-request-wins、计时器、副作用与鉴权收口逻辑不再留在页面组件内
- `app/login/page.tsx`、`app/register/page.tsx`、`app/recover/page.tsx` 已在当日迁移到专用页级 hook，不再由页面组件直接处理请求、埋点与提交状态
- `app/announcements/page.tsx` 已在当日迁移到 `useAnnouncementsPage` 模式，公告页的并发初始化、教师班级加载、发布后刷新与鉴权切换不再留在页面组件内
- `app/challenge/page.tsx` 已在当日迁移到 `useChallengePage` 模式，挑战任务加载、奖励领取、刷新错误和学生鉴权状态不再留在页面组件内
- `app/diagnostic/page.tsx` 已在当日迁移到 `useDiagnosticPage` 模式，诊断页的数据加载、鉴权切换、刷新失败提示和快照状态不再留在页面组件内
- `app/files/page.tsx` 已在当日迁移到 `useFilesPage` 模式，文件中心的启动加载、班级切换、资料列表刷新、上传提交与文件输入引用不再留在页面组件内
- `app/wrong-book/page.tsx` 已在当日迁移到 `useWrongBookPage` 模式，后续又进一步拆成 `useWrongBookLoaders.ts` + `useWrongBookActions.ts`，错题闭环页的并发加载、订正任务生成、复练提交与局部消息状态不再留在页面组件或单个大 hook 内
- `app/school/students/page.tsx`、`app/school/teachers/page.tsx`、`app/school/classes/page.tsx` 已在当日迁移到页级 hook，目录页的数据加载、筛选派生、刷新状态和学校管理员鉴权逻辑不再留在页面组件内
- `app/student/growth/page.tsx`、`app/student/modules/page.tsx`、`app/student/exams/page.tsx` 已在当日迁移到学生页级 hook，学习成长、模块概览、在线考试的请求编排、刷新状态和模块切换副作用不再堆在页面组件内
- `app/admin/logs/page.tsx`、`app/admin/knowledge-tree/page.tsx` 已在当日迁移到管理端页级 hook，日志筛选、知识树加载、刷新逻辑和鉴权状态不再留在页面组件内
- `app/library/[id]/page.tsx` 已在当日迁移到 `useLibraryDetailPage` 模式，资料详情页的并发加载、标注提交、分享链接生成与知识点修正请求不再留在页面组件内
- `app/library/shared/[token]/page.tsx` 已在当日迁移到专用页级 hook，公开分享态的加载、鉴权降级与错误分支不再留在页面组件内
- 当前 `app/**/page.tsx` 直接请求入口已经清空，后续前端维护重点转向超大 hook / 工作台的继续拆层与定向状态单测。

影响：

- 页面复用和测试切入点不足。
- 页面组件容易持续膨胀。
- UX 文案、错误处理、请求生命周期不易标准化。

建议：

1. 把这批入口统一迁到 `usePageView / useXxxPage` 模式。
2. 提取统一的提交状态、错误映射、成功反馈策略。
3. 避免继续新增“页面里直接 requestJson”的模式。

### S2. 类型系统还有可见的 `any` 泄漏，复杂业务边界仍不够硬

当前不是“类型系统很差”，而是几个关键业务模块仍存在松类型点。

典型位置：

- `lib/assignment-ai.ts`
- `lib/auth.ts`
- `lib/db.ts`
- `lib/rubrics.ts`
- `lib/writing.ts`
- `lib/ai-router.ts`
- `lib/ai-utils.ts`
- `lib/assignments.ts`
- `lib/exams.ts`
- `app/student/assignments/[id]/utils.ts`

影响：

- 在 AI 结果、答案结构、题目草稿、富对象回写这类高变动边界上，类型收束不足会放大隐藏回归。

建议：

1. 先处理“跨模块传递”的 `any`，后处理“局部工具函数”的 `any`。
2. 优先为 AI 输出、考试答案、作业答案、题目草稿建立稳定 schema。

## 5. 中优先级发现

### S3. 浏览器 smoke 相对系统规模仍偏薄

当前浏览器回归并不弱，但和系统体量相比仍偏“关键链路采样”，不是“广覆盖保护网”。

当前快照：

- `68` 个页面
- `191` 个 API 路由
- `334` 条单测
- `14` 条浏览器 smoke

判断：

- 对 MVP 来说，这个烟测规模已经不错。
- 对当前项目复杂度来说，浏览器级覆盖仍偏薄，尤其是对象存储、复杂筛选器、长表单、多角色跨端联动这几类路径。

建议：

1. 下一轮优先补 `school`、`library`、`admin` 的高风险流。
2. 为“重工作台抽 hook”增加状态迁移单测，减少只靠 smoke 兜底。

### S3. 重工作台的信息密度仍然偏高，尤其是学校端、管理端、资料库

项目已经明确在做 Action-first 收口，这一点是成立的：

- `app/student/page.tsx`、`app/teacher/page.tsx`、`app/parent/page.tsx` 都把“现在先做什么”放在首屏前部。
- `components/WorkspacePage.tsx` 统一了加载态、鉴权态、错误态、空态和提示栈。
- `components/MobileAppNav.tsx` 与 `components/GlobalCommandPalette.tsx` 已经提供移动端和全局搜索补偿。

但问题仍然存在：

- school/admin/library 这类重工作台信息层级多、操作密度高。
- 当前更多是“把组件组织得更合理”，还不是“显著降低复杂度本身”。

建议：

1. 用“主线任务区 / 辅助判断区 / 低频管理区”重新划分重工作台信息层级。
2. 对学校排课、资料库、管理端分别定义一个“首屏不超过 3 个核心决策点”的约束。

## 6. 主要优势

### 6.1 产品不是拼装页，而是多角色业务闭环

从学生、教师、家长到学校、管理端，当前仓库展示的是完整业务面，而不是“多个孤立功能页面”：

- 学生端有任务、课表、画像、考试、作业、陪练、错题。
- 教师端有班级、作业、考试、学情、通知、座位、教学执行。
- 家长端有周报、行动跟进、订正、收藏复盘。
- 学校端有班级、教师、排课、组织边界。
- 管理端有 AI 配置、实验开关、资料导入、可观测性、恢复工单。

这意味着项目的产品重心已经从“做功能”转向“管复杂度和可扩张性”。

### 6.2 API 架构纪律明显好于一般原型项目

正面证据：

- `lib/api/route-factory.ts` 提供统一路由工厂、角色约束、same-origin、缓存头、参数校验、请求上下文。
- `lib/api/http.ts` 统一输出 `code / message / data / requestId / traceId / timestamp`。
- `lib/api/domains/admin.ts` 默认把管理端路由角色收口到 `admin`。

收益：

- 可读性、统一性、可追踪性都明显更强。
- 安全和运维能力不是零散补丁，而是已经开始固化到底层框架。

### 6.3 安全成熟度明显高于“教育场景原型”的常见水位

关键证据：

- `lib/auth-security.ts` 已实现登录失败计数、锁定窗口、失败阈值控制。
- `lib/admin-step-up.ts` 对高风险管理操作增加短时 step-up cookie，并且在生产环境缺 secret 时直接拒绝服务，不做静默降级。
- `lib/readiness-probe.ts` 在生产态要求 readiness token 或管理员身份。
- `lib/guard.ts` 与学校端路由明确做了跨校边界控制。
- `app/api/observability/client-error/route.ts` 对客户端错误上报强制 same-origin。

结论：

- 当前项目的安全姿态已经不是“先通流程再说”，而是“关键边界已有结构化保护”。
- 剩余风险更多来自复杂度和运维闭环，而不是基础安全缺失。

### 6.4 UI 系统和导航体系是统一的，而且有明确方向

正面证据：

- `app/styles/tokens.css` 定义了统一主题变量、排版、阴影、动效和背景语义。
- `components/WorkspacePage.tsx` 统一工作台框架。
- `components/MobileAppNav.tsx` 已提供移动端抽屉导航、底部 tabbar、功能搜索。
- `components/GlobalCommandPalette.tsx` 已支持快捷搜索、别名匹配、最近访问、直达导航。

判断：

- 这个项目的 UI 不是默认组件库堆出来的。
- 它已经形成了面向教育工作台的统一视觉和交互语言。

## 7. 适合做什么，不适合做什么

当前适合：

- 单校试点
- 小范围真实用户试用
- 业务闭环验证
- 教学场景的内部演示与半真实运营

当前不适合：

- 大规模学校并行接入
- 高强度 SLA 承诺
- 依赖少量工程师长期硬扛的持续复杂扩张
- 对运维观测、审计追踪、故障响应要求更高的正式商用环境

## 8. 30 / 60 / 90 天建议

### 30 天

1. 修正本地 production-like 测试幂等性，确保重复执行不再假红灯。
2. 把 `school schedules`、`practice`、`admin ai models`、`tutor`、`teacher notifications`、`wrong-book`、`teacher submissions`、`parent` 这批剩余热点继续按状态层 / 副作用层 / 动作层拆开，并补齐对应状态迁移单测。
3. 补充 4 到 6 条浏览器 smoke，优先覆盖对象存储、学校端、管理端高风险流。
4. 给剩余 `23` 个 JSON 运行态文件做治理分级。

### 60 天

1. 把 error tracking / alert webhook 变成 staging/prod 默认要求。
2. 为已完成的页级 hook 收口补状态迁移单测，并继续拆 school/admin 高风险大 hook。
3. 为 AI 输出、考试答案、作业答案等高风险对象补 schema 与类型收束。
4. 做一次 school/admin/library 三端的首屏减压改版。

### 90 天

1. 形成 release candidate 级发布门：严格测试、fresh-db production-like、远端 smoke、观测阈值联动。
2. 为租户隔离、高风险管理操作、对象存储链路建立更系统的回归矩阵。
3. 把当前“试点 beta”正式推进到“可复制发布候选”。

## 9. 本轮评估证据

### 文档与代码复核

重点复核了以下内容：

- `README.md`
- `docs/project-readiness-index.md`
- `docs/development-checklist.md`
- `docs/p0-productization-checklist.md`
- `docs/staging-production-release-runbook.md`
- `docs/strict-testing-baseline.md`
- `lib/api/route-factory.ts`
- `lib/api/http.ts`
- `lib/api/domains/admin.ts`
- `lib/auth-security.ts`
- `lib/admin-step-up.ts`
- `lib/runtime-guardrails.ts`
- `lib/storage.ts`
- `lib/observability.ts`
- `lib/observability-alerts.ts`
- `lib/error-tracker.ts`
- `lib/readiness-probe.ts`
- `lib/guard.ts`
- `components/WorkspacePage.tsx`
- `components/MobileAppNav.tsx`
- `components/GlobalCommandPalette.tsx`
- `app/student/page.tsx`
- `app/teacher/page.tsx`
- `app/parent/page.tsx`

### 动态检查结果

本轮新增复核：

- `npm run check:project-snapshot`：通过
  - `pages: 68`
  - `apiRoutes: 191`
  - `unitTestFiles: 96`
  - `unitTestCases: 334`
  - `browserSpecFiles: 1`
  - `browserSmokeCases: 14`
  - `dataJsonFiles: 23`
- `npm run test:unit`：通过
  - `334` 条用例全部通过
- `npm run build`：通过
- `npm run test:school-schedules:production-like:local`：在复用本地默认数据库 `hk_aiedu_local` 时失败
  - 失败点：`scripts/api-test/suites/school-schedules.mjs`
  - 失败信息：`409 班级节次时间冲突`
- `PRODUCTION_LIKE_DB_NAME=hk_aiedu_audit_20260318 npm run test:school-schedules:production-like:local`：通过
  - 说明业务规则本身未被本轮证据证明失效，当前更接近本地测试环境幂等性问题
- 修复脚本后，默认 `npm run test:school-schedules:production-like:local` 连续执行两次均通过
  - 两次运行均使用不同的隔离数据库名
  - 两次运行结束后隔离数据库均被自动删除

同轮审查中已完成、可继续沿用的结果：

- `npm run verify:strict`：通过
- `npm run test:smoke:production-like:local`：通过

## 10. 最终结论

这不是一个“要不要继续做”的项目，而是一个“已经值得继续做，但必须进入更严格产品化阶段”的项目。

如果只看功能数量，它已经够多。
如果看真实工程质量，它已经明显高于一般 demo。
如果看能不能安全、稳定、低成本地继续放大，它现在的短板也已经非常清楚：

- 本地 production-like 测试需要变得可重复、可信
- 超大工作台和 hook 需要继续拆层
- 长尾运行态和观测接警需要进一步收口
- 重工作台的认知负荷需要持续压缩

一句话结论：

- 当前项目是 `强 beta / 可试点`
- 还不是 `可规模复制的 release candidate`
