# P0 深度优化任务卡（可直接开工）

更新时间：2026-02-27  
适用范围：HK-AI-EDU 全量系统（学生/教师/家长/管理端）

## 执行节奏（建议 2 周）

第 1 周：
- P0-1 认证安全加固
- P0-2 掌握度增量更新
- P0-6 资料库列表瘦身

第 2 周：
- P0-3 统一复练调度引擎
- P0-4 AI 策略执行闭环
- P0-5 AI 配置与日志入库

---

## P0-1 认证安全加固（登录限流 + 密码策略）

目标：
- 阻断暴力破解和弱密码输入，降低账号风险。

后端改造：
- `POST /api/auth/login` 增加 IP+邮箱维度限流与短时锁定。
- `POST /api/auth/register`、`POST /api/auth/teacher-register`、`POST /api/auth/admin-register` 增加统一密码强度校验。
- 新增 `lib/auth-security.ts`（限流、锁定、解锁、审计辅助）。

数据改造：
- 新增表 `auth_login_attempts`：
  - `key`（ip+email hash）
  - `failed_count`
  - `first_failed_at`
  - `lock_until`
  - `updated_at`

前端改造：
- 登录页显示剩余重试/锁定提示文案。
- 注册页显示密码强度规则提示。

验收标准：
- 连续失败达到阈值后登录返回 429/锁定提示。
- 锁定时间到后可正常登录。
- 弱密码注册被拒绝，强密码可通过。

回滚方案：
- 环境变量开关 `AUTH_SECURITY_ENFORCE=false` 时回退旧逻辑。

---

## P0-2 掌握度增量更新（替代全量重算）

目标：
- 将练习提交链路从“全量重算”改为“按题增量更新”，降低延迟。

后端改造：
- `POST /api/practice/submit`、`POST /api/wrong-book/review-result` 改为调用 `updateMasteryByAttempt`。
- `lib/mastery.ts` 新增增量更新方法：
  - 单题提交直接更新对应 `knowledge_point_id` 的 `correct_count/total_count/mastery_score`。
- 保留 `syncMasteryFromAttempts` 作为日终校准任务（脚本或 cron）。

数据改造：
- 利用现有 `mastery_records`，无需新表。
- 补充索引：`(user_id, subject, knowledge_point_id)`。

验收标准：
- 提交后返回的 `masteryScore/masteryDelta/weaknessRank` 与旧逻辑误差可控。
- 提交接口 p95 时延较改造前下降（目标 >30%）。

回滚方案：
- 开关 `MASTERY_INCREMENTAL_ENABLED=false` 切回全量同步模式。

---

## P0-3 统一复练调度引擎（错题复练 + 记忆复习）

目标：
- 解决双引擎并行导致的任务重复与优先级冲突。

后端改造：
- 新增 `lib/review-scheduler.ts` 作为统一调度层。
- `POST /api/practice/submit`、`POST /api/wrong-book/review-result`、`POST /api/diagnostic/submit` 全部走统一调度写入。
- `GET /api/practice/next?mode=review` 与 `GET /api/wrong-book/review-queue` 从统一队列读取。

数据改造：
- 新增表 `review_tasks`：
  - `user_id`
  - `question_id`
  - `source_type`（wrong/memory/exam）
  - `interval_level`
  - `next_review_at`
  - `status`
  - `last_result`
  - `updated_at`

验收标准：
- 同一用户同一题同一天不出现重复复练任务。
- 队列统计（dueToday/overdue/upcoming）与详情一致。

回滚方案：
- 开关 `UNIFIED_REVIEW_ENGINE=false`，回退到旧表读写。

---

## P0-4 AI 策略执行闭环（预算 + 质量阈值生效）

目标：
- 让管理端配置的 `budgetLimit/minQualityScore` 从“展示”变成“真正拦截”。

后端改造：
- `lib/ai.ts` 的 `callRoutedLLM` 增加：
  - 输入预算限制（超预算直接拒绝或降级）
  - 输出质量评分检查（低于阈值触发 fallback provider/rule output）
  - 失败原因结构化日志记录
- 统一返回 `provider/fallbackCount/qualityScore/policyHit` 元信息。

API 改造：
- 受影响接口包括 `assist/coach/explanation/outline/review-pack/ai-review` 等 AI 路由。

验收标准：
- 配置极低预算时，AI 请求可被策略命中并返回可解释错误。
- 配置高质量阈值时，低质量结果能自动降级。

回滚方案：
- 开关 `AI_POLICY_ENFORCE=false`，仅保留 timeout/retry。

---

## P0-5 AI 运行配置与调用日志入库（替代本地 JSON）

目标：
- 解决多实例部署下 AI 配置不一致、日志分裂问题。

后端改造：
- `lib/ai-config.ts`、`lib/ai-task-policies.ts` 增加 DB 存储实现。
- 优先读库，文件存储仅本地开发兜底。

数据改造：
- 新增表：
  - `ai_provider_configs`
  - `ai_task_policies`
  - `ai_call_logs`
- 为 `ai_call_logs` 增加时间、任务类型、provider 索引。

迁移步骤：
- 启动时读取旧 JSON 数据并一次性写库。
- 写入成功后标记迁移完成。

验收标准：
- 两个实例读取到同一份 AI 配置与任务策略。
- 管理端指标页展示跨实例汇总数据。

回滚方案：
- 开关 `AI_CONFIG_STORE=file`，暂时回退本地文件模式。

---

## P0-6 资料库性能优化（列表轻载 + 内容重载）

目标：
- 避免列表接口返回大体积 `contentBase64`，提升加载速度。

后端改造：
- `GET /api/library` 返回轻量字段，不返回 `contentBase64/textContent`。
- `GET /api/library/[id]` 保留完整内容用于详情阅读。
- `lib/learning-library.ts` 增加 `list projection`（summary/detail 两种结构）。

前端改造：
- `app/library/page.tsx` 列表仅展示摘要。
- 下载/预览改为进入详情页或触发详情接口按需加载。

验收标准：
- 列表接口响应体积下降明显（目标 >80%）。
- 列表页首屏时间显著下降。
- 详情页阅读、下载、标注功能保持可用。

回滚方案：
- 开关 `LIBRARY_LIGHT_LIST=false`，恢复旧返回结构。

---

## 统一发布门槛（全部 P0 完成后）

- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run test:api` 通过。
- 关键链路冒烟：
  - 登录/注册
  - 练习提交与掌握度变化
  - 错题复练队列
  - AI 生成与策略降级
  - 资料库列表与详情阅读

