# Runtime State Inventory

更新时间：2026-03-12

目的：把当前仍可落在 JSON 运行时存储的状态文件按风险和迁移优先级分层，避免后续数据库迁移只靠口头记忆推进。

## 1. P0 阻断级

这些文件已经进入运行时 guardrails 的高频状态集合，生产环境应优先迁移到数据库。

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
| `mastery-records.json` | `lib/mastery.ts` | 中 | 掌握度画像已具备 DB 路径，不应继续落本地 |
| `correction-tasks.json` | `lib/corrections.ts` | 中 | 订正执行状态会影响家长跟进与学习闭环 |
| `notifications.json` | `lib/notifications.ts` | 中 | 站内消息需要跨实例一致，避免重复和漏发 |
| `parent-action-receipts.json` | `lib/parent-action-receipts.ts` | 中 | 家长执行回执需要稳定证据链 |
| `analytics-events.json` | `lib/analytics.ts` | 中 | 埋点量大且已具备 DB 表，适合直接禁用生产 JSON fallback |

## 2. P0-P1 迁移优先级

这些文件还没被设为“生产即阻断”，但已经足够重要，应该进入下一波数据库迁移。

| 文件 | 主要模块 | 影响链路 |
| --- | --- | --- |
| `question-attempts.json` | `lib/progress.ts` | 练习记录与掌握度计算输入 |
| `study-plans.json` | `lib/progress.ts` | 学习计划与学生首页任务组织 |
| `wrong-review-items.json` | `lib/wrong-review.ts` | 错题复练闭环 |
| `review-tasks.json` | `lib/review-tasks.ts` | 统一复练队列 |
| `memory-reviews.json` | `lib/memory.ts` | 记忆复习链路 |

## 3. 暂可后移

这些文件也建议逐步数据库化，但不必排在最前。

| 文件 | 主要模块 | 说明 |
| --- | --- | --- |
| `announcements.json` | `lib/announcements.ts` | 写频相对较低 |
| `assignment-uploads.json` | `lib/assignment-uploads.ts` | 文件已逐步对象存储化，元数据仍可后续收口 |
| `class-schedules.json` | `lib/class-schedules.ts` | 学校排课做大后应迁移 |
| `classes.json` / `class-students.json` / `class-join-requests.json` | `lib/classes.ts` | 已有多租户基础，适合在组织模型阶段统一迁移 |
| `learning-library*` 相关 | `lib/learning-library.ts` | 内容类写频相对低于学习过程数据 |

## 4. 推荐迁移顺序

1. 登录与审计
2. 作业、考试、通知与家长回执执行链路
3. 掌握度、计划、练习与复练链路
4. 分析与运营埋点

## 5. 代码对应关系

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
- 家长回执：`lib/parent-action-receipts.ts`
- 运营埋点：`lib/analytics.ts`
