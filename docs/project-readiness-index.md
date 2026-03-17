# Project Readiness Index

更新时间：2026-03-17

用途：作为“当前项目状态 + P0 阻断项 + 测试 / 发布 / 运行时存储入口”的统一检索页。拿不准先看哪份文档时，先从这份开始。

## 1. 当前快照

- 项目阶段：已超过 MVP，更接近“可试点 beta 产品”，但还不是可规模复制的 release candidate。
- 当前规模：`68` 个页面、`191` 个 API 路由、`78` 个单测文件。
- 当前自动化：`test:unit` 当前为 `201` 条用例；`1` 个浏览器 smoke 文件，内含 `14` 条关键流程 smoke。
- 当前剩余文件态：当前工作树 `data/` 目录下还有 `23` 个 JSON 文件，`23` 个均已具备 DB canonical path，当前可见文件中已无 JSON-only 项。
- 当前前端收口重点：大页拆层和 latest-request-wins 加固已经覆盖 `files`、`library detail`、`school`、`practice`、`notifications`、`teacher notifications`、`admin questions` 等高频工作台。

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
- 浏览器 smoke 目前只有 `14` 条关键路径，对整个项目规模而言覆盖仍偏薄。
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

- 保持当前 `14` 条 smoke 一直可用：
  - 学生进入执行优先首页
  - 教师发布作业
  - 家长提交行动回执
  - 用户提交账号恢复请求
  - 管理员异常登录后收到安全告警通知
  - 用户连续登录失败后被临时锁定
  - 学生完成老师发布考试并提交
  - 学生上传作业附件并由教师在批改页读取 / 下载
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

- 当前最大 hook / 页面热点：
  - `app/school/schedules/useSchoolSchedulesPage.ts`
  - `app/admin/ai-models/useAdminAiModelsPage.ts`
  - `app/library/useLibraryPage.ts`
- 当前仍有页面层直接发请求的入口：
  - `app/admin/experiments/page.tsx`
  - `app/admin/register/page.tsx`
  - `app/focus/page.tsx`
  - `app/school/register/page.tsx`
  - `app/teacher/register/page.tsx`

## 5. 文档维护约定

- 只要页面、API、单测、smoke、`data/*.json` 数量发生明显变化，就同步更新本页快照。
- 只要 P0 阻断项状态变化，就同步更新 `docs/p0-productization-checklist.md`。
- 只要发布路径、质量门、远端 smoke 发生变化，就同步更新 `docs/strict-testing-baseline.md` 与 `docs/staging-production-release-runbook.md`。
- 若新增周度 checklist 或专项 runbook，务必把入口补到 README 的“运营与治理文档索引”里。
