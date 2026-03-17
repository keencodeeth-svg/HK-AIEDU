# Runtime State Inventory

更新时间：2026-03-17

目的：把当前仍可落在 JSON 运行时存储的状态文件按风险和迁移优先级分层，避免后续数据库迁移只靠口头记忆推进。

## 1. P0 阻断级

这一批高频执行态已于 2026-03-15 收口为应用运行时的 DB-only 状态，并进入严格测试基线；仅 `API_TEST_SCOPE` 的隔离测试运行时仍保留临时 JSON fallback。

| 文件 | 主要模块 | 风险 | 原因 |
| --- | --- | --- | --- |
| `sessions.json` | `lib/auth.ts` | 高 | 登录态是多实例一致性的最小门槛 |
| `auth-login-attempts.json` | `lib/auth-security.ts` | 高 | 登录限流和锁定不能依赖单机文件 |
| `auth-login-profiles.json` | `lib/auth-login-alerts.ts` | 高 | 异常登录识别需要全局一致视图 |
| `auth-recovery-attempts.json` | `lib/account-recovery.ts` | 高 | 恢复流程防滥用不能分散在本地实例 |
| `admin-logs.json` | `lib/admin-log.ts` | 高 | 高风险操作审计必须可靠、可检索 |
| `focus-sessions.json` | `lib/focus.ts` | 中 | 频繁写入，且会影响学生端连续体验 |
| `assignment-progress.json` | `lib/assignments.ts` | 高 | 作业执行状态直接影响学生、教师、家长三端一致性 |
| `assignment-submissions.json` | `lib/assignments.ts` | 高 | 学生提交结果不能在多实例下丢失或分叉 |
| `exam-assignments.json` | `lib/exams.ts` | 高 | 考试发放与开始状态需要全局一致 |
| `exam-answers.json` | `lib/exams.ts` | 高 | 自动保存草稿属于高频写入，不能依赖本机磁盘 |
| `exam-submissions.json` | `lib/exams.ts` | 高 | 考试提交与成绩归档是核心闭环 |
| `notifications.json` | `lib/notifications.ts` | 中 | 站内消息需要跨实例一致，避免重复和漏发 |
| `parent-action-receipts.json` | `lib/parent-action-receipts.ts` | 中 | 家长执行回执需要稳定证据链 |

补充：`mastery-records.json`、`correction-tasks.json`、`analytics-events.json`、`question-attempts.json`、`study-plans.json`、`wrong-review-items.json`、`review-tasks.json`、`memory-reviews.json` 也已于 2026-03-15 收口为应用运行时的 DB-only 状态，并纳入 `runtime:migrate:p0` 一次性迁移脚本。

## 2. P0-P1 迁移优先级

当前没有仍处于“已确认、未提升为阻断”的 P0 高频执行态队列。学校排课栈已于 2026-03-17 补齐 DB canonical path，并补入管理员课表只读 smoke 基线、独立 production-like API 回归与 browser smoke；公开账号恢复请求提交链路、管理员异常登录安全告警链路、登录锁定链路、学生考试提交链路、学生作业附件上传并由教师批改页读取 / 下载链路、恢复工单后台处理链路与资料库文件上传 / 下载 / 分享链路也已补入 browser smoke，且主干 CI 已接入强制 PostgreSQL + 对象存储下的 browser smoke。本轮又补齐了 `ai_eval_gate_runtime` / `ai_eval_gate_runs`、`student_personas`，并为 `ai-provider-config`、`ai-task-policies`、`ai-quality-calibration`、`ai-eval-gate`、`student-personas` 增加了“guarded DB bootstrap 不触碰 legacy JSON”的定向单测。最新一次 production-like browser 回归里已不再出现 JSON fallback 警告，说明当前已观察到的低频 runtime fallback warning inventory 已清零。下一轮优先级应转向其余对象存储读写链路浏览器回归、production-like 稳态维护与防止新的文件态回退重新引入。

## 3. 当前工作树 `data/*.json` 分类

当前工作树 `data/` 目录下还保留 `23` 个 JSON 文件。基于 `lib/*` 模块实现与 `db/schema.sql` 当前表结构判断：

- `23` 个文件已经具备 DB canonical path；生产环境里 JSON 只应承担本地 seed、demo fallback 或导入包角色。
- 当前工作树可见文件里已无 JSON-only 项。

### 3.1 已具备 DB canonical path 的文件

| 文件 | 主要模块 | DB 对应 | JSON 应承担的角色 | 说明 |
| --- | --- | --- | --- | --- |
| `users.json` | `lib/auth.ts` | `users` | 本地 bootstrap / demo seed | 登录、密码策略、学校管理员初始化在生产态不能依赖文件 |
| `schools.json` | `lib/schools.ts` | `schools` | 本地 bootstrap / demo seed | 学校是组织根数据，生产态应以 DB 为准 |
| `classes.json` / `class-students.json` / `class-join-requests.json` | `lib/classes.ts` | `classes` / `class_students` / `class_join_requests` | 本地 demo fallback 或初始化 seed | 已有多租户与同校校验基础，不应继续把组织关系长期放在 JSON |
| `class-schedules.json` | `lib/class-schedules.ts` / `lib/teacher-schedule-rules.ts` / `lib/teacher-unavailability.ts` / `lib/school-schedule-templates.ts` / `lib/assignment-lesson-links.ts` / `lib/school-schedule-ai-operations.ts` | `class_schedule_sessions` / `teacher_schedule_rules` / `teacher_unavailability_slots` / `school_schedule_templates` / `assignment_lesson_links` / `school_ai_schedule_operations` | 本地 seed / fallback / 历史导入来源 | 学校排课栈已具备 DB canonical path，JSON 只保留给本地无 DB 运行、demo 数据或空表首次导入 |
| `student-profiles.json` | `lib/profiles.ts` | `student_profiles` | 本地 fallback | 画像与观察码已可进 DB，生产态不应回写本地文件 |
| `knowledge-points.json` / `questions.json` | `lib/content.ts` | `knowledge_points` / `questions` | 导入包 / 本地 seed | 内容文件可以保留为导入来源，但管理端编辑后的 canonical 数据应在 DB |
| `question-quality-metrics.json` | `lib/question-quality.ts` | `question_quality_metrics` | 本地 fallback / seed 指标 | 题库治理评分已具备 DB 表承接 |
| `ai-quality-calibration.json` | `lib/ai-quality-calibration.ts` | `ai_quality_calibration_runtime` / `ai_quality_calibration_history` | 本地 fallback / 历史导入来源 | AI 质量校准配置与快照已具备 DB canonical path，JSON 只保留给本地无 DB 运行或一次性迁移接管 |
| `announcements.json` | `lib/announcements.ts` | `announcements` | 低频 fallback | 公告写频不高，但生产态仍应以 DB 为准 |
| `experiment-flags.json` | `lib/experiments.ts` | `experiment_flags` | 本地 demo fallback | 灰度开关属于运行时治理配置，生产态不能依赖单机文件 |
| `ai-history.json` | `lib/ai-history.ts` | `ai_history` | 本地 demo fallback | AI 历史记录已可入库，JSON 仅保留给本地无 DB 运行 |
| `assignments.json` / `assignment-items.json` | `lib/assignments.ts` | `assignments` / `assignment_items` | 本地 demo fallback | 作业定义和题项已经有 DB canonical path |
| `assignment-uploads.json` | `lib/assignment-uploads.ts` | `assignment_uploads` | 元数据 fallback | 文件内容已逐步对象存储化，生产态应走“DB 元数据 + 对象存储内容” |
| `assignment-reviews.json` / `assignment-review-items.json` | `lib/reviews.ts` | `assignment_reviews` / `assignment_review_items` | 本地 demo fallback | 批改结果和批注项已可落库 |
| `assignment-rubrics.json` / `assignment-review-rubrics.json` | `lib/rubrics.ts` | `assignment_rubrics` / `assignment_review_rubrics` | 本地 demo fallback | rubric 已有 DB 承接，JSON 不应再是生产主存储 |
| `exam-papers.json` / `exam-paper-items.json` | `lib/exams.ts` | `exam_papers` / `exam_paper_items` | 本地 seed / demo fallback | 试卷定义和题项已能走 DB；若保留 JSON，更适合作为导入模板 |

### 3.2 当前工作树可见文件中已无 JSON-only 项

截至 2026-03-17，当前工作树 `data/` 目录下可见的 `23` 个 JSON 文件都已经具备 DB canonical path。

补充说明：

- 学校排课栈已完成 DB canonical 收口，涉及 `class_schedule_sessions`、`teacher_schedule_rules`、`teacher_unavailability_slots`、`school_schedule_templates`、`assignment_lesson_links`、`school_ai_schedule_operations`。
- `class-schedules.json` 仍可作为本地 seed、demo fallback 或空表首次导入来源，但不再是唯一 canonical 运行时状态。

## 4. 当前结论

1. P0 高频执行态已全部进入 DB-only 运行基线
2. 当前工作树 `data/` 目录下可见的 `23` 个 JSON 文件都已经具备 DB canonical path，当前已无可见 JSON-only 项
3. 当前已观察到的 production-like browser JSON fallback warning inventory 已清零
4. `runtime:migrate:p0` 仍保留一次性迁移入口，方便把历史运行态导入数据库
5. 后续重点应转向：
   - 其余对象存储读写链路的 browser 回归
   - 其余低频内容态 / 组织态 fallback 的持续巡检，防止新回退

## 5. 执行命令

在数据库 schema 已初始化后，可以先执行：

`npm run runtime:migrate:p0`

约定与 `lib/storage.ts` 一致：

- 优先读取 `DATA_DIR`（默认 `.runtime-data`）下的运行态 JSON。
- 如果运行态文件不存在，再回退读取 `DATA_SEED_DIR`（默认 `data`）下的种子文件。
- 当前脚本已覆盖会话、登录安全、异常登录画像、恢复尝试、审计日志、作业进度与提交、练习尝试、学习计划、考试发放与答题草稿与提交、掌握度、订正任务、统一复练队列、错题复练、记忆复习、通知、埋点、家长回执、专注记录。

## 6. 代码对应关系

- 运行时 guardrails：`lib/runtime-guardrails.ts`
- readiness 检查：`lib/health.ts`
- 会话：`lib/auth.ts`
- 登录安全：`lib/auth-security.ts`
- 恢复流程：`lib/account-recovery.ts`
- 管理审计：`lib/admin-log.ts`
- 作业：`lib/assignments.ts`
- 考试：`lib/exams.ts`
- 进度与计划：`lib/progress.ts`
- 掌握度：`lib/mastery.ts`
- 复练队列：`lib/review-tasks.ts`
- 错题复练：`lib/wrong-review.ts`
- 记忆复习：`lib/memory.ts`
- 家长回执：`lib/parent-action-receipts.ts`
- 运营埋点：`lib/analytics.ts`
