# P0 产品化 Issue 清单（可直接建 GitHub Issues）

更新时间：2026-03-11  
来源：`README.md` 第 5 节与第 5.1 节  
适用阶段：试点学校上线前

说明：
- 旧版 P0 任务卡中不少事项已经落地，本文改为维护“当前仍需推进”的 P0 issue。
- 拆分方式按四条主线：安全、发布、测试、观测。
- 每张卡默认对应一个 GitHub issue；完成后应同步回写 README 与发布手册。

## 推荐排期（2 到 3 周）

第 1 周：
- P0-S1 管理员 2FA 与高风险操作二次校验
- P0-S2 会话、限流、审计状态持久化收口
- P0-R1 生产环境配置护栏（DB + 对象存储强制）

第 2 周：
- P0-T1 `lib/*` 关键领域单测补齐
- P0-T2 关键角色 E2E 与权限/并发回归
- P0-R2 staging / production 发布链路与 smoke / rollback

第 3 周：
- P0-O1 外部错误追踪与 traceId 串联
- P0-O2 SLO、告警、巡检与复盘机制

## 完成判定

- `npm run lint`、`npm run build`、`npm test` 全通过。
- 关键 E2E smoke 通过，且 CI 可阻断合并。
- 生产环境不再依赖 `data/*.json` 和本地文件态 session。
- 发布链路具备迁移、健康检查、smoke、回滚的标准步骤。
- 核心故障可通过外部监控 + `traceId` 在 5 分钟内定位。

## Issue 总览

| ID | 标题 | 主线 | 价值 |
| --- | --- | --- | --- |
| P0-S1 | 管理员 2FA 与高风险操作二次校验 | 安全 | 防管理员账号被盗与误操作 |
| P0-S2 | 会话、限流、审计状态持久化收口 | 安全 | 解决多实例一致性风险 |
| P0-R1 | 生产环境配置护栏（DB + 对象存储强制） | 发布 | 防止“带着 fallback 上生产” |
| P0-R2 | staging / production 发布链路与 smoke / rollback | 发布 | 让版本可发布、可回滚 |
| P0-T1 | `lib/*` 关键领域单测补齐 | 测试 | 把质量门前移到领域逻辑层 |
| P0-T2 | 关键角色 E2E 与权限/并发回归 | 测试 | 补齐真实业务链路保障 |
| P0-O1 | 外部错误追踪与 traceId 串联 | 观测 | 让线上错误可被发现和定位 |
| P0-O2 | SLO、告警、巡检与复盘机制 | 观测 | 让试点运行具备运维闭环 |

---

## P0-S1 管理员 2FA 与高风险操作二次校验

建议 GitHub issue 标题：`feat(auth): enforce admin 2FA and step-up verification`

问题背景：
- 当前已具备 `Origin` 防护、显式 `confirmAction`、管理员审计日志。
- 但管理员登录仍主要依赖单一密码，高风险操作也没有“近期二次验证”门槛。

建议涉及文件：
- `app/api/auth/login/route.ts`
- `lib/auth.ts`
- `lib/api/route-factory.ts`
- `lib/admin-audit.ts`
- `app/api/admin/recovery-requests/[id]/route.ts`
- `app/api/admin/ai/config/route.ts`
- `app/api/admin/ai/quality-calibration/route.ts`
- `app/admin/recovery-requests/page.tsx`
- `app/admin/ai-models/page.tsx`

交付物：
- 管理员 2FA 绑定/解绑能力，优先支持 TOTP + 恢复码。
- 管理员登录后的二次验证流程。
- 高风险操作要求近期 `step-up verification`，例如 10 分钟内验证有效。
- 审计日志增加 `verificationMode`、`reverifiedAt`、`riskLevel` 等上下文字段。

验收标准：
- 未绑定 2FA 的管理员在强制模式下不能执行高风险操作。
- 已绑定 2FA 的管理员登录后必须完成第二因子校验。
- 超过“近期验证窗口”后，再次执行高风险操作会被拒绝并提示重新验证。
- 管理端日志可以看到是谁、何时、通过什么方式完成了二次验证。

回滚方案：
- 环境变量 `ADMIN_2FA_ENFORCE=false` 可暂时降级为提示模式。

---

## P0-S2 会话、限流、审计状态持久化收口

建议 GitHub issue 标题：`refactor(auth): persist session and throttling state for multi-instance deployment`

问题背景：
- 当前 `lib/auth.ts` 在非 DB 模式下仍会写 `sessions.json`。
- 登录限流、找回流程防滥用、部分治理状态仍可能依赖文件态或单实例内存语义。
- 一旦进入多实例部署，容易出现会话、锁定状态、审计数据不一致。

建议涉及文件：
- `lib/auth.ts`
- `lib/auth-security.ts`
- `lib/account-recovery.ts`
- `lib/admin-audit.ts`
- `lib/storage.ts`
- `lib/db.ts`
- `scripts/init-db.mjs`

交付物：
- 会话、登录失败计数、恢复流程限流、关键审计状态统一落到 DB 或缓存层。
- 明确“本地开发允许 fallback，部署环境禁止 fallback”的边界。
- 为现有运行时文件态数据提供迁移或一次性清理策略。
- 为并发登录/登出、锁定/解锁建立回归用例。

验收标准：
- `DATABASE_URL` 开启时，不再依赖 `data/sessions.json` 维护有效会话。
- 两个实例同时运行时，登录、登出、锁定状态保持一致。
- 密集失败登录不会因实例切换而绕过限流。
- 审计日志在多实例下仍能按时间和 `traceId` 完整串联。

回滚方案：
- 开关保留本地开发 fallback，但生产环境不得启用。

---

## P0-R1 生产环境配置护栏（DB + 对象存储强制）

建议 GitHub issue 标题：`feat(runtime): add production guardrails for database and object storage`

问题背景：
- 当前 `lib/db.ts` 已支持 `REQUIRE_DATABASE`，但“生产必须 DB + 对象存储”还没有形成完整 fail-fast 护栏。
- `lib/object-storage.ts` 当前默认本地路径 `.runtime-data/objects`，如果部署配置不完整，容易带着演示态能力上线。

建议涉及文件：
- `lib/db.ts`
- `lib/object-storage.ts`
- `lib/storage.ts`
- `scripts/migrate-file-payloads-to-object-storage.mjs`
- `README.md`
- 部署环境变量文档

交付物：
- 增加统一运行时环境校验模块，启动时校验 DB、对象存储、inline content、JSON fallback 等关键开关。
- 明确生产环境不允许 `ALLOW_JSON_FALLBACK=true`。
- 明确生产环境对象存储的要求：至少是持久卷/外部对象存储，不允许依赖临时磁盘。
- 文档中补齐迁移步骤、失败提示和发布前检查项。

验收标准：
- 生产环境缺少关键变量时，应用在启动阶段直接失败，而不是运行中退化。
- 文件内容迁移脚本可 dry-run、可重复执行、结果可审计。
- 发布前可以明确判断当前环境是否仍处于演示态配置。

回滚方案：
- 预发环境可通过显式环境变量放宽，但生产环境不允许回退。

---

## P0-R2 staging / production 发布链路与 smoke / rollback

建议 GitHub issue 标题：`build(release): establish staging-prod deploy pipeline with smoke and rollback`

问题背景：
- 当前已有 CI、API 集成测试、灰度发布手册，但“预发 -> 生产”的标准链路仍不完整。
- 现有 `/api/health` 与观测能力更偏应用内视角，缺少发布前后统一检查清单。

建议涉及文件：
- `.github/workflows/ci.yml`
- `scripts/test-api-routes.mjs`
- `docs/week8-gray-release-runbook.md`
- `app/api/health/route.ts`
- 新增发布 runbook / smoke checklist 文档

交付物：
- 建立 staging 与 production 的标准发布步骤：迁移、健康检查、smoke、放量、回滚。
- 利用现有 `API_TEST_SCOPE=smoke` 补齐预发 smoke 命令与文档。
- 区分公开 `liveness` 与受保护的 `readiness/admin metrics` 检查口径。
- 形成一次完整的回滚演练记录。

验收标准：
- 新版本发布前后有固定清单可执行，而不是依赖个人经验。
- 预发环境可自动执行 smoke，并输出结果。
- 回滚路径在文档和脚本层都可实际执行。
- 健康检查能区分“服务存活”和“核心依赖可用”。

回滚方案：
- 保留人工发布路径，但必须沿用同一份 smoke / rollback 清单。

---

## P0-T1 `lib/*` 关键领域单测补齐

建议 GitHub issue 标题：`test(unit): add unit coverage for core domain libraries`

问题背景：
- 当前 `npm test` 主要覆盖 API 集成回归。
- 领域逻辑层如密码策略、登录限流、恢复防滥用、复练调度、AI 策略门禁等，缺少稳定的单测防线。

建议涉及文件：
- `lib/password.ts`
- `lib/auth-security.ts`
- `lib/account-recovery.ts`
- `lib/review-scheduler.ts`
- `lib/review-tasks.ts`
- `lib/ai-task-policies.ts`
- `lib/ai-quality-control.ts`

交付物：
- 选定并接入单测方案，优先轻量级且适合当前仓库。
- 为至少 5 个关键领域模块补齐边界条件测试。
- 在 `package.json` 中新增 `test:unit`，并接入 CI。
- 输出一份“哪些逻辑必须先写单测再改”的约定。

验收标准：
- 单测可本地稳定运行，且 CI 可阻断合并。
- 限流阈值、密码策略、恢复节流、调度优先级、AI 策略命中等关键逻辑有明确断言。
- 单测失败时，能快速定位到对应领域模块，而不是只看到接口回归失败。

回滚方案：
- 若首轮范围过大，可先锁定认证、安全、调度三类核心模块。

---

## P0-T2 关键角色 E2E 与权限/并发回归

建议 GitHub issue 标题：`test(e2e): cover critical role flows and permission regressions`

问题背景：
- 当前 API 测试已覆盖不少后端链路，但前端关键流程、跨角色路径、越权场景仍缺浏览器级验证。
- 多租户、跨班级、跨学校、并发写入问题更适合用 E2E 和专项回归来兜底。

建议涉及文件：
- 现有 API 测试脚本：`scripts/test-api-routes.mjs`
- 现有 suites：`scripts/api-test/suites/*`
- 学生、教师、管理员、学校管理员关键页面与接口
- 新增 E2E 测试目录与配置

交付物：
- 引入 E2E 框架，优先覆盖 4 条关键链路：
  - 学生登录 -> 练习提交 -> 复练任务生成
  - 教师查看预警 -> 执行动作 -> 审计留痕
  - 管理员修改 AI 配置/恢复工单 -> 二次确认 -> 日志记录
  - 学校管理员查看学校域数据 -> 权限边界校验
- 增加跨租户越权、跨班级读取、并发登录/并发提交的专项回归。
- 将最小 smoke 集纳入发布前检查。

验收标准：
- 至少 1 条学生、1 条教师、1 条管理员、1 条学校管理员主链路 E2E 可稳定跑通。
- 存在明确的越权失败断言，而不只是成功流测试。
- 并发回归能覆盖登录锁定、恢复申请限流、关键配置写入冲突等场景。

回滚方案：
- 若完整 E2E 上线过重，先落关键 smoke 与权限回归，再扩全链路。

---

## P0-O1 外部错误追踪与 traceId 串联

建议 GitHub issue 标题：`feat(observability): integrate external error tracking with trace correlation`

问题背景：
- 当前仓库已经有 `x-trace-id`、API 路由观测、AI 调用日志。
- 但线上异常仍主要依赖应用内日志和管理端查看，缺少外部聚合与告警入口。

建议涉及文件：
- `lib/api/http.ts`
- `lib/request-context.ts`
- `lib/observability.ts`
- `app/dashboard/error.tsx`
- `app/api/admin/observability/metrics/route.ts`
- 新增外部错误追踪初始化文件

交付物：
- 接入 Sentry 兼容或同类错误追踪平台。
- 将 `traceId`、用户角色、路由、关键实体 ID 写入错误上下文。
- 统一服务端异常、前端渲染异常、AI 调用异常的上报口径。
- 为错误聚合页和管理端指标页建立字段对照关系。

验收标准：
- 人工制造一个 500，可在外部平台看到完整事件与 `traceId`。
- 通过 `traceId` 可从外部平台回查到 API 日志/AI 日志/管理员审计。
- 上报链路失败时不影响主业务请求返回。

回滚方案：
- 保留本地日志为兜底；若外部平台不可用，上报应自动降级。

---

## P0-O2 SLO、告警、巡检与复盘机制

建议 GitHub issue 标题：`docs(observability): define SLOs alerts and operational runbooks`

问题背景：
- 当前已有 `/api/admin/observability/metrics` 和 `/api/health`，但还没有试点学校运行所需的统一 SLO 与告警机制。
- 尤其 `/api/health` 当前更像受保护的管理接口，不适合作为外部可探测的标准健康检查入口。

建议涉及文件：
- `app/api/health/route.ts`
- `app/api/admin/observability/metrics/route.ts`
- `lib/observability.ts`
- `docs/week8-gray-release-runbook.md`
- 新增值班/事故复盘文档

交付物：
- 定义最小 SLO：登录成功率、核心 API 可用性、AI 生成成功率、考试提交成功率。
- 明确告警阈值：5xx 激增、P95 异常、AI 超时率、登录失败率异常、健康检查失败。
- 将健康检查拆成适合外部探测的 `liveness` 与适合内部治理的 `readiness/metrics`。
- 建立发布后巡检表、值班排障流程、事故复盘模板。

验收标准：
- 至少 4 类关键告警有明确阈值和责任人。
- 新版本发布后能按统一清单完成巡检。
- 一次模拟事故可以形成标准复盘记录，而不是只停留在聊天记录。

回滚方案：
- 若外部告警平台尚未接齐，先在文档中明确人工巡检与手动报表流程。

---

## 建议的 GitHub Labels / Milestone

- Labels：
  - `p0`
  - `security`
  - `release`
  - `testing`
  - `observability`
  - `productization`
- Milestone：
  - `Pilot Readiness`

## 建议的建单顺序

1. 先建 `P0-S2` 与 `P0-R1`，先把运行底座和部署边界收紧。
2. 再建 `P0-T1` 与 `P0-T2`，把质量门补上。
3. 然后推进 `P0-S1`，避免在未收口的环境上直接叠加 2FA。
4. 最后完成 `P0-R2`、`P0-O1`、`P0-O2`，形成完整发布与运维闭环。
