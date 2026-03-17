# Development Checklist

更新时间：2026-03-17

来源：2026-03-15 全项目复评（产品 / 技术 / 用户体验 / UIUX）

用途：把“项目评估结论”和“后续 90 天路线图”压成一份持续开发清单。后续新增任务、拆 issue、做 PR、安排周计划时，默认先对照这份文档归类，不再重复从头评估。

关联文档：

- `docs/project-readiness-index.md`
- `docs/strict-testing-baseline.md`
- `docs/p0-optimization-task-cards.md`
- `docs/p0-productization-checklist.md`
- `docs/runtime-state-inventory.md`
- `docs/staging-production-release-runbook.md`

建议查阅顺序：

1. 先看 `docs/project-readiness-index.md`，确认项目当前阶段、风险和文档入口。
2. 再看本清单，确认优先级、硬规则和 90 天节奏。
3. 遇到存储、测试或发布问题时，再跳到对应专项文档。

## 1. 当前判断

- 项目定位：已经超过 MVP，更接近“可试点 beta 产品”，但还没有完全进入“可规模复制的产品化阶段”。
- 产品评分：`8.3 / 10`
- 技术评分：`7.8 / 10`
- 用户体验评分：`7.1 / 10`
- UI / UX 评分：`7.9 / 10`
- 试点就绪度：`7.5 / 10`

当前最强的三点：

- 多角色闭环已经成型，学生、教师、家长、学校、管理端不是孤立页面，而是能串出真实业务链路。
- 工程底座明显变强，已经具备严格测试门、production-like smoke、数据库与对象存储护栏的基础。
- 视觉语言已经有统一性，大多数页面不是拼装型后台，而是有明确场景化表达。

当前最大的四个风险：

- 产品面过宽，首批试点到底讲哪条主线，还没有完全收敛到“最强闭环”。
- 领域分层还在进行中，几个最大工作台页面虽然开始拆，但还没有全部完成状态、请求、展示分离。
- 高密度工作台的信息层级仍偏重，教师、学生、家长首页都还有“看起来很多、决策入口偏挤”的问题。
- 教学效果证据链还偏弱，当前更像“功能完整”，还不够像“能证明提分或提效”的产品。

## 2. 后续开发硬规则

1. 默认质量门是 `npm run verify:strict`，不是 `npm test`。
2. 任何涉及运行时状态、DB 迁移、对象存储、生产护栏的改动，提交前默认补跑 `npm run test:smoke:production-like:local`。
3. 任何涉及登录、权限、管理员操作、家长回执、作业/考试提交的改动，优先补浏览器或 API 回归，不接受只补单测。
4. 不再新增生产运行时 JSON 状态；新状态默认先考虑 DB / 缓存 / 对象存储边界。
5. 改大页时默认按“状态层、请求层、展示层”抽离，禁止整页重写式返工。
6. 每个开发项都要写清楚五件事：交付物、涉及文件、必跑测试、验收标准、回滚方式。
7. 未完成 `P0` 之前，不主动再扩角色面和新业务面，优先收口现有主链路。

## 3. 当前已完成的基线

- [x] 严格质量门已统一为 `verify:strict`
- [x] API 测试运行时与浏览器 smoke 已收口到更一致的契约
- [x] 本地 production-like smoke 已支持复用现有 PostgreSQL
- [x] 学校排课 AI 预演 / 应用 / 回滚已具备独立 production-like API 回归入口
- [x] 主干 CI 的 production-like regression 已顺序执行 smoke + 学校排课深回归
- [x] 主干 CI 的 production-like regression 已补入强制 PostgreSQL + 对象存储下的浏览器 smoke
- [x] 浏览器 smoke 已覆盖学校管理员排课 AI 预演 / 应用 / 回滚闭环
- [x] 浏览器 smoke 已覆盖学校管理员组织边界隔离
- [x] 浏览器 smoke 已覆盖公开账号恢复请求提交流程
- [x] 浏览器 smoke 已覆盖管理员异常登录安全告警通知
- [x] 浏览器 smoke 已覆盖连续登录失败后的临时锁定
- [x] 浏览器 smoke 已覆盖学生考试提交闭环
- [x] 浏览器 smoke 已覆盖学生作业附件上传并由教师批改页读取 / 下载
- [x] 浏览器 smoke 已覆盖恢复工单后台处理闭环
- [x] 浏览器 smoke 已覆盖资料库文件上传 / 下载 / 分享闭环
- [x] 仓库已移除高频运行态 JSON seed 污染，避免 readiness 被伪信号干扰
- [x] `data/*.json` 的高频运行态文件已从仓库跟踪面移出，并补了 hygiene 回归测试
- [x] 浏览器 smoke 已覆盖管理员 step-up 闭环与教师越权访问 admin API 拦截
- [x] `createAdminRoute` 已默认收紧为 admin 角色门禁，`/api/health*` 例外探针显式豁免
- [x] API 测试运行器与 same-origin 本地口径已统一，`127.0.0.1 / localhost` 不再互相打架

说明：

- 以上只是“底座开始可信”，不等于 `P0` 已完成。
- 后续所有开发都默认建立在这些基线上，不要回退到“只靠手测”或“只跑 npm test”的节奏。

## 4. 总优先级顺序

### P0：试点底座必须继续收口

- 权限与 same-origin / step-up / 越权回归补齐
- 会话、限流、审计等运行态彻底 DB-only 化
- staging / production 发布、smoke、rollback、observability 固化
- 关键浏览器回归补到真正能阻断合并

### P1：主工作台可维护性和可用性提升

- 大页拆层继续推进
- 教师 / 学生 / 家长首页首屏降噪
- 高密度工作台的动作优先级、失败态、空态统一
- 移动端与真实演示路径收口

### P2：试点效果证明和规模化准备

- 教学效果证据层
- AI 治理与质量评测闭环强化
- 多学校 / 组织 / 租户边界进一步收紧
- 合规、留存、导出、审计制度化

## 5. 90 天执行清单

### Week 1：收敛首批试点主叙事

- 主目标：把“学生任务推进 -> 教师干预 -> 家长回执”定为首批对外主线，其余能力作为支撑面，不再并列讲述。
- 重点文件：
  - `app/student/page.tsx`
  - `app/teacher/page.tsx`
  - `app/parent/page.tsx`
  - `components/RoleSidebarNav.tsx`
  - `components/GlobalCommandPalette.tsx`
- 必跑测试：
  - `npm run verify:strict`
- 完成标志：
  - 三个角色首页首屏都只回答“现在先做什么”
  - 首页一级入口数量下降，演示顺序可以在 3 分钟内讲清
  - README / 演示材料中的主叙事与页面首屏一致

### Week 2：补齐高风险认证与权限浏览器回归

- 主目标：把管理员 step-up、越权拦截、same-origin 契约变成浏览器级与 API 级双保险。
- 重点文件：
  - `lib/api/route-factory.ts`
  - `lib/auth.ts`
  - `lib/auth-security.ts`
  - `app/api/auth/login/route.ts`
  - `tests/browser/smoke.spec.ts`
- 必跑测试：
  - `npm run verify:strict`
  - `npm run test:smoke:production-like:local`
- 完成标志：
  - 管理员高风险操作有稳定回归
  - 学生 / 家长 / 教师跨角色或跨资源访问被自动化断言拦截
  - same-origin 规则在 API 与浏览器测试中不再出现环境口径不一致

### Week 3：把 P0 运行态彻底从 JSON 收口到 DB

- 主目标：优先完成会话、登录限流、恢复防滥用、关键审计状态的 DB-only 化，并同步文档库存。
- 重点文件：
  - `lib/auth.ts`
  - `lib/auth-security.ts`
  - `lib/account-recovery.ts`
  - `lib/admin-audit.ts`
  - `db/schema.sql`
  - `scripts/migrate-p0-runtime-state-to-db.mjs`
  - `docs/runtime-state-inventory.md`
- 必跑测试：
  - `npm run verify:strict`
  - `npm run test:smoke:production-like:local`
- 完成标志：
  - 生产模式下不再依赖会话与认证相关 `data/*.json`
  - 多实例语义下登录、登出、锁定、恢复限流保持一致
  - `runtime-state-inventory` 中 P0 阻断项继续收缩

### Week 4：固化发布链路与观测闭环

- 主目标：把“能发布”和“出事能定位”做成标准路径，而不是经验操作。
- 重点文件：
  - `.github/workflows/ci.yml`
  - `scripts/run-production-like-smoke-local.sh`
  - `docs/staging-production-release-runbook.md`
  - `lib/error-tracker.ts`
  - `lib/health.ts`
- 必跑测试：
  - `npm run verify:strict`
  - `npm run test:smoke:production-like:local`
  - 远端 smoke
- 完成标志：
  - staging / production 有一致的 smoke 与 rollback 清单
  - 关键 500、AI 失败、readiness 失败能通过 `traceId` 快速定位
  - 发布演练文档可让新同事独立按步骤完成

### Week 5：继续拆学校排课工作台

- 主目标：把 `school/schedules` 从超大页继续拆成稳定的状态层、请求层与展示层，不做视觉重写。
- 重点文件：
  - `app/school/schedules/page.tsx`
  - `app/school/page.tsx`
  - `app/styles/pages.css`
- 必跑测试：
  - `npm run verify:strict`
  - 涉及排课 API 时补 API 回归
  - 涉及排课 AI 预演 / 应用 / 回滚、模板、教师规则、禁排时段或运行时状态时补跑 `npm run test:school-schedules:production-like:local`
- 完成标志：
  - 页面层只保留组装逻辑
  - 排课数据加载、AI 预览、模板、教师规则等模块具备可独立维护边界
  - 不再需要在一个文件里同时追状态、请求、展示

### Week 6：继续拆 tutor 工作台

- 主目标：把 `tutor` 继续按入口同步、解题流程、图片流程、历史记录、分享结果拆开。
- 重点文件：
  - `app/tutor/page.tsx`
  - `app/styles/pages.css`
- 必跑测试：
  - `npm run verify:strict`
  - 涉及 AI 结果回写时补 API 回归
- 完成标志：
  - `tutor/page.tsx` 不再承担多条流程的具体状态推进
  - 求解、图片识别、变式训练、分享结果的状态边界更清晰
  - 新改动不再需要在单页里跨多个阶段追副作用

### Week 7：继续拆教师高密度工作台

- 主目标：优先处理 `teacher/seating`、`teacher/notifications`、`teacher/exams` 三类高密度页面，统一命令区、列表区、执行区模式。
- 重点文件：
  - `app/teacher/seating/page.tsx`
  - `app/teacher/notifications/page.tsx`
  - `app/teacher/exams/page.tsx`
  - `app/teacher/exams/create/page.tsx`
  - `app/styles/components.css`
- 必跑测试：
  - `npm run verify:strict`
  - 涉及教师发布或批量动作时补浏览器 / API 回归
- 完成标志：
  - 教师工作台形成统一的交互骨架
  - 配置、预览、提交、历史、回滚的卡片模式更一致
  - 首屏默认只暴露当前最关键动作

### Week 8：压缩学生 / 家长 / 教师首页的信息噪音

- 主目标：针对真实演示与日常使用，把首屏从“信息堆叠”压到“优先级明确”。
- 重点文件：
  - `app/student/page.tsx`
  - `app/student/assignments/page.tsx`
  - `app/student/exams/page.tsx`
  - `app/parent/page.tsx`
  - `app/parent/_components/ParentActionCenterPanels.tsx`
  - `app/teacher/page.tsx`
- 必跑测试：
  - `npm run verify:strict`
  - 关键首页 smoke
- 完成标志：
  - 学生首页首屏只突出任务、原因、下一步
  - 家长首页首屏只突出今晚任务、需跟进风险、回执动作
  - 教师首页首屏只突出班级风险、待执行动作、当日闭环

### Week 9：补教学效果证据层

- 主目标：把“功能多”提升为“效果可解释”，先补教师与家长能读懂的证据视图。
- 重点文件：
  - `app/teacher/analysis/page.tsx`
  - `app/parent/page.tsx`
  - `app/dashboard/page.tsx`
  - `lib/dashboard-overview.ts`
  - `lib/analytics.ts`
- 必跑测试：
  - `npm run verify:strict`
  - 数据聚合相关单测 / API 回归
- 完成标志：
  - 能展示“任务执行 -> 干预动作 -> 结果变化”的最小证据链
  - 关键指标定义稳定，不再只是演示态文本
  - 家长与教师看到的是动作建议，不只是静态报表

### Week 10：强化 AI 治理与质量闭环

- 主目标：把 AI 能力从“功能入口很多”继续推进到“质量、预算、回退、灰度更清晰”。
- 重点文件：
  - `app/admin/ai-models/page.tsx`
  - `lib/ai-router.ts`
  - `lib/ai-task-policies.ts`
  - `app/api/admin/ai/config/route.ts`
  - `app/api/admin/ai/quality-calibration/route.ts`
- 必跑测试：
  - `npm run verify:strict`
  - AI 策略与质量门相关单测
- 完成标志：
  - 管理端能清楚区分 provider、policy、calibration、gray release 的边界
  - 关键任务类型有稳定质量基线
  - 切 provider 或调策略时不需要手工追大量隐式逻辑

### Week 11：补组织边界与多学校准备

- 主目标：在不扩新功能面的前提下，先把跨学校、跨班级、跨角色边界收紧，给后续多校试点留空间。
- 重点文件：
  - `lib/auth.ts`
  - `lib/api/route-factory.ts`
  - `app/api/school/*`
  - `app/school/page.tsx`
- 必跑测试：
  - `npm run verify:strict`
  - 权限矩阵 API / 浏览器回归
- 完成标志：
  - 关键资源访问有清晰租户或组织边界
  - 跨学校误读、误改、误发的风险被测试覆盖
  - 多角色切换时导航与入口语义不混乱

### Week 12：试点演练与最终收口

- 主目标：按真实试点视角，完成一轮从部署、账号、演示、回滚到问题定位的完整 rehearsal。
- 重点文件：
  - `README.md`
  - `docs/staging-production-release-runbook.md`
  - `docs/strict-testing-baseline.md`
  - `docs/p0-productization-checklist.md`
- 必跑测试：
  - `npm run verify:strict`
  - `npm run test:smoke:production-like:local`
  - 远端 smoke
- 完成标志：
  - 可以按文档完成一轮试点演练
  - 故障处理、回滚、账号演示、关键流程验证都有固定清单
  - P0 是否完成可以用清单明确判断，而不是口头判断

## 6. 长期常驻开发清单

下面这些项不按周结束，而是后续每次开发都要对照：

- [ ] 新改动是否直接服务于“学生任务推进 -> 教师干预 -> 家长回执”主链路
- [ ] 是否引入了新的生产运行时 JSON 状态
- [ ] 是否补了与风险等级匹配的测试层级
- [ ] 是否把大页继续往状态层 / 请求层 / 展示层推进，而不是继续堆逻辑
- [ ] 是否减少了首屏决策噪音，而不是继续堆卡片
- [ ] 是否补了错误态、空态、加载态，而不是只优化成功路径
- [ ] 是否能在演示里说明这项能力为什么能提升学习效率或教学效率
- [ ] 是否更新了对应文档，而不是让运行方式继续靠口口相传

## 7. 后续查阅顺序

后续继续开发时，默认按这个顺序查阅：

1. 先看本文件，确认当前任务属于哪一周或哪一类常驻清单。
2. 再看 `docs/strict-testing-baseline.md`，确认要跑到哪一层测试。
3. 如果涉及生产态或运行时状态，再看 `docs/runtime-state-inventory.md` 与 `docs/staging-production-release-runbook.md`。
4. 如果任务属于 P0 收口，再回看 `docs/p0-optimization-task-cards.md` 与 `docs/p0-productization-checklist.md`。

## 8. 暂不主动扩张的事项

在以下事项没有明显拉高试点成功率之前，默认不主动扩大投入：

- 新角色中心页
- 新收费或套餐前台流程
- 更多演示型 AI 入口
- 大面积视觉重做
- 没有证据链支撑的新数据大盘

理由：当前最稀缺的不是功能点，而是可信底座、清晰主线、低摩擦工作台和可证明的效果。
