# 航科（K12 AI 教育平台）

面向 K12 的 AI 教育产品原型，覆盖学生、教师、家长、学校管理员、平台管理员五端，围绕“诊断 -> 计划 -> 练习 -> 复练 -> 干预 -> 反馈 -> 验证”的提分闭环构建。

更新时间：2026-03-17

## 1. 项目定位

航科不是单点工具，而是一个完整的学习运营系统：

- 学生端：练习、错题复练、考试测评、成长画像、AI 陪练
- 教师端：班级作业、考试组卷、预警干预、讲评包、AI 教案/课件
- 家长端：周报行动卡、执行回执、效果跟踪
- 学校端：学校总览、组织管理、班级管理（学校租户范围）
- 管理端：题库治理、知识点治理、AI 模型路由、A/B 灰度、操作审计

核心目标：

- 提升“有效学习结果”而不是仅提升使用时长
- 把 AI 从“生成内容”升级到“可治理、可观测、可回滚”
- 支持从演示环境平滑迁移到数据库部署

近期新增（2026-03-17）：

- 新增 `docs/project-readiness-index.md` 作为项目状态、P0 阻断项、测试与发布入口的统一索引
- 学校排课栈、AI 质量校准、AI eval gate 与 student personas 均已具备 DB canonical path；当前工作树 `data/` 目录下可见的 `23` 个 JSON 文件都已完成 DB 对应关系梳理
- 单测基线扩到 `90` 个测试文件、`235` 条用例，新增 `API_TEST_SUITE=school-schedules` 的独立深排课回归与 production-like 本地入口
- 主干 CI 的 production-like 回归作业已顺序执行 `test:smoke:production-like`、`test:browser:production-like` 与 `test:school-schedules:production-like`
- 浏览器 smoke 新增账号恢复请求、登录锁定、管理员异常登录安全告警通知、学生考试提交、学生作业附件上传并由教师批改页读取 / 下载、恢复工单后台处理、资料库文件上传 / 下载 / 分享、学校管理员排课 AI 预演 / 应用 / 回滚与学校组织边界回归，当前整套关键流程 smoke 为 `14` 条；最新 production-like 浏览器回归里的 runtime fallback 告警已清零

此前里程碑（2026-03-01）：

- 全学科全年级知识点批量生成升级：支持分批预览、分批入库、批次进度提示，移除旧的组合/条数硬上限
- 知识点导入去重修复：去重键升级为 `subject+grade+unit+chapter+title`，避免跨学科/跨年级误判
- 管理端导航升级：左侧导航支持功能搜索、最近访问、分组全展开/全收起
- 全站 UI 重设计：统一 Claymorphism 视觉风格，提升层级感与可读性
- 学校管理员与多租户 V1：新增 `school_admin` 角色、学校控制台与组织级权限隔离
- 租户字段落地：`schools`、`users.school_id`、`classes.school_id`，班级链路执行同校校验

## 2. 功能全景

### 2.1 学生端（提分主链路）

- 诊断 -> 计划：基于诊断结果生成学习计划，支持 `/api/plan/refresh` 动态刷新
- 练习 -> 评估：普通/闯关/限时/错题/自适应/记忆复习等模式统一提交入口，提交即更新 `masteryScore` 与 `masteryDelta`
- 薄弱点优先推荐：从“随机推荐”升级为“薄弱知识点优先”，并展示推荐原因
- 错题闭环：错题自动进入 `24h/72h/7d` 间隔复练队列，复练结果继续回流掌握度
- 在线考试闭环：老师发布考试 -> 学生作答提交 -> 自动判分与归档 -> 错题自动回流复练队列
- AI 学习辅助闭环：错题讲解/变式训练/对话陪练/写作批改，形成“提问 -> 解释 -> 练习 -> 再验证”
- AI 可信度治理：讲解返回 citation 置信度、可信等级、风险等级与复核提示，避免“看起来正确但不可验证”
- AI 长期记忆：学生陪练历史上下文延续，支持连续学习会话
- 成长可视化：能力雷达、成长档案、任务总览、学习趋势跟踪

### 2.2 教师端（教学闭环）

- 班级组织闭环：创建班级 -> 学生入班（邀请码/申请审批）-> 学生归属管理
- 作业闭环：发布作业 -> 收集提交 -> 批改与统计 -> 错因标签 -> 定向修复任务
- 考试闭环：组卷 -> 发布 -> 防作弊事件记录 -> 成绩导出 -> 发布讲评包 -> 推送复练
- 风险预警闭环：识别风险学生/风险知识点 -> 推荐动作 -> 一键执行 -> 影响追踪
- 干预执行闭环：一键布置修复任务、一键通知学生、一键确认处理，减少教师重复操作成本
- AI 教学工具闭环：教案/课件/讲评顺序/复练单自动生成，教师审核后一键下发

### 2.3 家长端（执行闭环）

- 周报行动化输出：每周自动生成 `actionItems`、`estimatedMinutes`、`parentTips`
- 执行回执闭环：家长对每条建议执行“完成/跳过（含原因）”回执
- 效果关联闭环：系统追踪 completionRate、effect score、近 7 天趋势，回看建议有效性

### 2.4 管理端（运营与治理）

- 题库治理闭环：导入/生成 -> 质量评分 -> 重复簇/歧义/答案冲突识别 -> 高风险隔离池 -> 复检回流
- 知识点治理闭环：树结构导入/AI 生成 -> 批量预览 -> 人工修正 -> 批量入库 -> 审计留痕
- 全学科全年级批量生成：支持大规模组合分批处理与进度反馈，提升真实运营可用性
- AI 路由治理：多模型链、任务级策略、预算/质量阈值、调用指标统一管理
- AI 健康诊断：provider 配置状态与缺失环境变量诊断，降低配置错误成本
- 实验治理闭环：A/B 开关 -> 分流比例 -> 结果报告 -> 灰度放量/一键回滚
- 审计闭环：关键操作落日志，支持问题追踪与责任回放

### 2.5 学校端（组织闭环）

- 组织总览闭环：学校管理员查看本校教师/学生/班级/作业规模总览
- 成员管理闭环：按学校租户范围查看教师与学生列表
- 班级治理闭环：学校维度查看班级规模、作业负载与教师归属
- 权限边界：平台管理员可跨学校，学校管理员仅可访问本校数据

### 2.6 体验与可用性（产品使用闭环）

- 左侧导航闭环：功能搜索 -> 快速进入 -> 最近访问沉淀 -> 二次访问提效
- 信息架构闭环：按角色与业务阶段分组，支持全展开/全收起，降低“找功能”成本
- 视觉反馈闭环：全站 Claymorphism 风格统一，强化层级、可点击性与状态反馈

## 3. 学习闭环（业务主流程）

1. 诊断：学生完成测评，系统识别薄弱知识点与初始能力基线
2. 计划：系统基于掌握度与薄弱点生成任务，学生端可刷新并重排优先级
3. 练习：学生完成练习/考试提交，系统实时更新掌握度并返回可解释反馈
4. 复练：错题自动进入 `24h/72h/7d` 队列，复练结果继续回流模型
5. 预警：教师端每日看到风险学生与风险知识点，并获得可执行动作建议
6. 干预：教师一键下发修复任务，学生执行后进入下一轮学习
7. 协同：家长端收到行动卡并回执执行，形成“建议 -> 执行 -> 效果”链路
8. 验证：管理端通过漏斗指标与 A/B 结果判断策略有效性，决定放量或回滚

## 4. 已实现能力清单

- [x] 账号体系（学生/家长/教师/学校管理员/平台管理员）
- [x] 认证安全（登录限流、密码策略、旧密码迁移）
- [x] 管理员高风险操作二次验证（短时 step-up）
- [x] 学习计划与掌握度增量更新
- [x] 错题闭环与间隔复习队列
- [x] 在线考试（教师发布、学生提交、防作弊事件、导出）
- [x] 考试错题自动入复练队列
- [x] 挑战系统 2.0（学习证明校验）
- [x] 教师风险预警 + 一键动作 + 影响追踪
- [x] 家长行动回执闭环
- [x] 题库质量治理 V2（重复簇、歧义、答案一致性、隔离池）
- [x] 全学科全年级知识点批量生成（分批预览/分批入库/进度提示，移除硬上限）
- [x] 知识点导入去重修复（`subject+grade+unit+chapter+title`）
- [x] 教材/课件/教案资料库（导入、阅读、标注、分享、分学科管理）
- [x] 资料库列表轻载 + 详情重载 + 服务端分页筛选
- [x] 管理端侧栏导航增强（功能搜索、最近访问、分组全展开/全收起）
- [x] 全站 Claymorphism UI 风格统一（卡片、按钮、导航、表单）
- [x] 资料库文件对象存储适配（文件内容可脱离 DB 存储，DB 仅保留元数据）
- [x] 显式数据库迁移命令（`db:migrate`），运行时不再自动建表
- [x] 统一授权中间层 V1（角色 + 班级归属校验抽离复用）
- [x] 学校组织模型与多租户隔离 V1（`schools` + `users/classes.school_id` + 学校端 API）
- [x] traceId 贯穿 API 响应头、AI 调用日志与外部错误上报上下文（便于跨链路排障）
- [x] AI 多模型路由（zhipu/deepseek/kimi/minimax/seedance/compatible/custom）
- [x] AI 任务策略（providerChain、timeout、retries、budget、minQualityScore）
- [x] AI 配置与日志 DB 优先存储（多实例一致）
- [x] AI 离线评测集扩展（讲解/作业评语/知识点生成/写作反馈/教案提纲/题目质检）
- [x] AI 评测到校准闭环（评测建议 `calibrationSuggestion` -> 一键写入质量校准）
- [x] AI 质量校准灰度开关（enable/rolloutPercent/salt）+ 快照回滚
- [x] RAG 引用可信度治理（citation confidence/trust/risk + 人工复核提示）
- [x] AI 陪练长期记忆 V1（历史会话上下文）
- [x] 运营埋点漏斗 + A/B 灰度发布
- [x] 教师干预因果看板增强（家长执行参与率/效果分/有无家长协同分差）
- [ ] 付费套餐与订阅

## 5. 当前迭代路线图（ROI 优先）

为避免路线图停留在方向描述，下面把未完成项改写为可执行清单。推进顺序按 `P0 -> P1 -> P2`，每项都要求同时给出交付物与验收标准。

### P0（本轮必须推进：稳定性、发布能力、安全收口）

1. 测试分层补齐（当前已有 API 集成测试与 CI）
   交付物：补 `lib/*` 关键领域单测，补学生/教师/家长/学校管理员关键 E2E，补权限、恢复流程、并发写入回归样例。
   验收标准：`npm run lint`、`npm run build`、`npm test` 与关键 E2E smoke 全通过；CI 失败可阻断合并。

2. 发布链路标准化
   交付物：建立 `staging / production` 双环境发布流程，补迁移脚本、健康检查、发布后 smoke、失败回滚说明。
   验收标准：从干净环境按文档可完成部署；至少完成一次发布和回滚演练。

3. 生产存储治理收口（当前 DB / 对象存储已具备基础能力）
   交付物：生产强制 PostgreSQL + 对象存储，关闭生产 JSON fallback；会话、限流、审计等高频状态统一落到 DB/缓存层。
   验收标准：生产配置下不再依赖 `data/*.json` 写入；多实例部署时登录、限流、审计结果一致。

4. 安全与权限治理收口（当前已补 Origin 校验、恢复流程防滥用）
   交付物：补齐 CSRF/Origin 覆盖面、管理员 2FA / step-up、异常登录告警、权限矩阵回归测试。
   验收标准：高风险接口统一防护；跨学校、跨班级、跨角色越权回归全部通过；关键操作可审计到操作者与 traceId。

5. 可观测性与告警接入
   交付物：接入外部错误追踪、日志聚合、慢接口榜单、AI 调用失败率告警、基础 SLO。
   验收标准：出现 500、AI 失败或核心漏斗异常时，可在 5 分钟内定位到 traceId 与责任链路。

6. AI 内核拆层
   交付物：拆分 `provider adapter / policy engine / task handlers`，明确配置边界、预算控制与回退策略。
   验收标准：新增 provider 或任务类型时无需改核心主链；离线评测、质量校准、灰度发布能力保持可用。

### P1（试点增强：提分效果、运营动作、资源配置）

1. 掌握度引擎 V2
   交付物：引入时间衰减、难度权重、置信度，对接练习、考试、错题和复练链路。
   验收标准：同一学生跨模块掌握度结果一致，教师端可看到变化原因与建议动作。

2. 教师干预自动化
   交付物：从共性错因自动生成讲评包、巩固作业与通知模板。
   验收标准：教师可一键下发，且能回收完成情况与结果变化。

3. 家长执行效果关联分析
   交付物：建立“家长参与 -> 学习行为 -> 成绩变化”的指标链与看板。
   验收标准：家长触达、执行率、学生改善之间能被量化展示。

4. RAG 质量评测闭环
   交付物：补离线评测集、引用可信度阈值、人工复核提示、错误样本沉淀流程。
   验收标准：关键任务类型均有质量分基线，低可信输出可被识别和拦截。

5. 套餐订阅最小闭环
   交付物：支持套餐定义、学校/班级额度、到期提醒、人工开通与续期记录。
   验收标准：即便不接在线支付，也能支持主管部门拨付、学校分配和试点名额管理。

### P2（规模化：差异化能力、多校复制、合规完善）

1. 学生 AI 教练长期记忆 V2
   交付物：引入更稳定的学习画像、阶段目标和跨会话策略。
   验收标准：连续多周使用后，建议内容能体现历史上下文，而非仅依赖单次对话。

2. 自适应考试与能力诊断增强
   交付物：补能力标签、题目难度、自适应出题与诊断报告联动。
   验收标准：考试结果能直接回流到掌握度、复练和教师干预链路。

3. 学校组织能力 V2
   交付物：支持多校区、多学校管理员协同、跨校运营面板、租户级配置。
   验收标准：同一平台可服务多所学校，且权限边界清晰。

4. 合规与隐私体系完善
   交付物：补未成年人数据最小化、留存/删除/导出策略、家长授权与审计机制。
   验收标准：关键数据流转、访问范围、保留周期均有制度与技术双重约束。

## 5.1 推到产品级的关键改进空间

当前项目已经具备完整业务闭环，更接近“可试运行的教育产品”。要推到真正的产品级，关键不是继续堆功能，而是建立一套“可上线、可治理、可复制”的阶段性验收门槛。

### P0（上线前必须全部通过）

1. 环境与数据基线
   清单：生产强制 `DATABASE_URL` 与对象存储，关闭 JSON fallback；会话、限流、审计状态统一持久化；完成备份和回滚演练。
   退出条件：多实例部署稳定运行，生产不再依赖本地文件态存储。

2. 安全与权限基线
   清单：补齐 CSRF/Origin、防滥用、管理员 2FA、权限矩阵回归、异常登录告警。
   退出条件：越权、重放、滥用、异常登录均有阻断或告警，且审计日志可追溯。

3. 质量与发布基线
   清单：完成单测/API/E2E 分层，建立 staging/prod 流水线，补 smoke checklist 与失败回滚机制。
   退出条件：每次发布都有自动检查和人工兜底，不再依赖口头经验或本机状态。

4. 观测与运维基线
   清单：接入外部错误追踪、日志聚合、慢接口与 AI 失败告警，明确 SLO 和事故复盘模板。
   退出条件：故障能够被发现、定位、复盘，并沉淀为后续治理项。

### P1（试点学校阶段）

1. 教学效果可验证
   清单：落地掌握度 V2、教师干预自动化、家长执行效果看板。
   退出条件：能向学校展示“使用 -> 干预 -> 提升”的证据链，而不只是功能演示。

2. AI 治理可控
   清单：把离线评测、质量校准、灰度发布、预算控制、人工复核纳入标准流程。
   退出条件：模型切换与策略调整可以量化评估，并支持回退。

3. 角色体验可持续
   清单：补移动端回归、空态/失败态统一、新用户引导、关键流程性能基线。
   退出条件：学生、家长、教师、管理员核心流程在真实设备上可稳定完成。

4. 资源与套餐可配置
   清单：补齐套餐、额度、到期、人工开通与续期记录。
   退出条件：即便不走市场化在线支付，也能支持主管部门拨付、学校分配与试点名额管理。

### P2（规模化复制阶段）

1. 多校组织与运营
   清单：支持多校区、多学校管理员协同、跨校面板、租户级配置。
   退出条件：同一平台可复制到多所学校，权限边界清晰，运维成本可控。

2. 合规与隐私体系
   清单：补未成年人数据最小化、留存/删除/导出、家长授权、密钥管理、审计导出。
   退出条件：数据流转有制度与技术双重控制，可满足校方与主管部门检查。

3. 差异化能力
   清单：推进 AI 教练长期记忆 V2、自适应考试、跨周期学习画像。
   退出条件：形成可持续复用、且难以被简单替代的教学效果闭环。

4. 成本与容量治理
   清单：建立对象存储生命周期、日志归档、冷数据清理、AI 成本监控。
   退出条件：规模增长时，成本曲线、容量上限与服务质量都可预测。

### 当前最优先的三件事

1. 生产环境彻底切换到 DB + 对象存储，并清掉生产 JSON fallback。
2. 把权限/安全/回归和发布链路补齐，把上线门槛从“能跑”提升到“能发布”。
3. 接入外部监控告警与质量门，形成可定位、可回滚、可审计的试点运行能力。

配套 issue 拆分见：`docs/p0-optimization-task-cards.md`

## 6. 技术架构（文字版）

```text
┌───────────────────────────────┐
│           Client 层            │
│ 浏览器（学生/家长/教师/学校/平台）│
└───────────────┬───────────────┘
                │ HTTP + Cookie Session
┌───────────────▼───────────────┐
│       Next.js App Router       │
│ 页面路由: app/*                │
│ API路由: app/api/*             │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│         业务服务层 lib/*        │
│ auth / schools / practice      │
│ exams / alerts / report        │
│ ai-routing / quality-control   │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│         数据访问层              │
│ lib/db.ts（PostgreSQL）        │
│ lib/storage.ts（JSON fallback）│
└───────────────┬───────────────┘
                │
      ┌─────────▼─────────┐
      │   PostgreSQL      │
      │   或 data/*.json  │
      └─────────┬─────────┘
                │
      ┌─────────▼─────────┐
      │ 外部 LLM Provider │
      │ 多模型链路 + 回退  │
      └───────────────────┘
```

## 7. 快速开始

### 7.1 本地启动（Local Demo / JSON 模式）

```bash
npm install
npm run dev
```

访问：`http://localhost:3000`

说明：

- `npm run dev` 默认带 `API_TEST_SCOPE=local-dev` 启动，适合无 DB 的本地 demo / JSON fallback 联调。
- 如果你需要直接运行不带本地 demo 契约的原始 Next.js dev server，请改用：

```bash
npm run dev:strict
```

- 修改登录、注册、恢复请求、analytics 等入口后，建议执行：

```bash
npm run verify:local-dev
```

### 7.2 本地启动（PostgreSQL 模式）

1. 设置环境变量：

```bash
DATABASE_URL=postgres://user:password@host:5432/dbname
DB_SSL=false
LIBRARY_OBJECT_STORAGE_ENABLED=true
LIBRARY_INLINE_FILE_CONTENT=false
FILE_OBJECT_STORAGE_ENABLED=true
FILE_INLINE_CONTENT=false
# OBJECT_STORAGE_ROOT=.runtime-data/objects

# 学校管理员注册邀请码（可选）
# SCHOOL_ADMIN_ALLOW_INITIAL_SELF_REGISTER=false
# SCHOOL_ADMIN_INVITE_CODE=...
# SCHOOL_ADMIN_INVITE_CODES=CODE1,CODE2
```

2. 初始化数据库并写入种子：

```bash
npm run db:migrate
npm run seed:base
npm run seed:stage3
npm run seed:library-db
```

说明：

- 配置 `DATABASE_URL` 后，系统走 DB，不再读取 `data/*.json`
- 未配置 `DATABASE_URL` 时使用 JSON fallback
- DB 模式需要先执行迁移命令（`db:migrate` 或兼容命令 `db:init`）

### 7.2.1 本地最小 PostgreSQL 环境（Docker）

如果本机已安装 Docker，推荐直接使用仓库内的本地编排文件：

```bash
npm run infra:postgres:up
```

默认会启动：

- PostgreSQL 16
- 端口：`127.0.0.1:54329`
- 数据库：`hk_aiedu_local`
- 用户名：`postgres`
- 密码：`postgres`

常用命令：

```bash
npm run infra:postgres:logs
npm run infra:postgres:down
```

### 7.2.2 本地 production-like smoke

本地要尽量贴近 CI / 生产配置时，直接跑：

```bash
npm run test:smoke:production-like:local
```

这条命令会自动执行：

1. 启动本地 PostgreSQL 容器
2. `npm run build`
3. `npm run db:migrate`
4. `npm run seed:base`
5. `npm run seed:stage3`
6. `npm run security:migrate-passwords`
7. `npm run test:smoke:production-like`

补充说明：

- 脚本会自动复制一份临时 `DATA_SEED_DIR`，并剔除 production guardrails 禁止的高频 JSON 运行态文件，避免仓库内遗留 seed 数据把 readiness 误报成失败
- 脚本会自动使用临时 `DATA_DIR` 与对象存储根目录，不污染仓库内 `.runtime-data`
- 默认会为每次本地 production-like 运行创建一个隔离临时数据库，避免复跑时复用上一次残留状态而出现假红灯

默认环境：

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/hk_aiedu_local_<run-id>
REQUIRE_DATABASE=true
ALLOW_JSON_FALLBACK=false
OBJECT_STORAGE_ROOT=.runtime-data/local-objects
FILE_OBJECT_STORAGE_ENABLED=true
LIBRARY_OBJECT_STORAGE_ENABLED=true
FILE_INLINE_CONTENT=false
LIBRARY_INLINE_FILE_CONTENT=false
```

如需覆盖数据库地址，可在命令前传入：

```bash
PRODUCTION_LIKE_DB_PORT=54330 npm run test:smoke:production-like:local
```

如需固定复用某个数据库名，可显式指定；如希望每次先清空该数据库，再额外加上 `PRODUCTION_LIKE_DB_RESET=1`：

```bash
PRODUCTION_LIKE_DB_NAME=hk_aiedu_local \
PRODUCTION_LIKE_DB_RESET=1 \
npm run test:smoke:production-like:local
```

如果想直接复用本机已经启动的 PostgreSQL，而不是等待 Docker 首次拉镜像，可运行：

```bash
PRODUCTION_LIKE_USE_EXISTING_DB=1 \
PRODUCTION_LIKE_DB_HOST=/tmp \
PRODUCTION_LIKE_DB_PORT=5432 \
PRODUCTION_LIKE_DB_USER="$USER" \
PRODUCTION_LIKE_DB_NAME=hk_aiedu_local \
PRODUCTION_LIKE_DB_RESET=1 \
DATABASE_URL="postgresql:///hk_aiedu_local" \
npm run test:smoke:production-like:local
```

如果机器上没有可用 Docker daemon，但本机已有可连接 PostgreSQL，这条“复用现有 DB”路径也是推荐做法。

如果要在同一条 DB-only / object-storage 路径下专门验证学校排课 AI 预演 / 应用 / 回滚链路，可运行：

```bash
npm run test:school-schedules:production-like:local
```

这条命令复用同一套 `build -> db:migrate -> seed:base -> seed:stage3 -> security:migrate-passwords` 路径，但最终执行的是独立排课 API 套件，而不是只读 smoke。
默认也会为这条深回归创建隔离临时数据库；如需保留固定数据库做排障，可显式设置 `PRODUCTION_LIKE_DB_NAME`，并按需加上 `PRODUCTION_LIKE_DB_RESET=1`。

如果要在同一条 DB-only / object-storage 路径下验证浏览器关键流程，可运行：

```bash
npm run test:browser:production-like:local
```

这条命令复用同一套 `build -> db:migrate -> seed:base -> seed:stage3 -> security:migrate-passwords` 路径，但最终执行的是 `tests/browser/smoke.spec.ts`，用于确认浏览器关键链路在强制 PostgreSQL + 对象存储配置下仍可通过。

### 7.3 旧文件数据迁移到对象存储

适用场景：历史数据仍在 `content_base64/contentBase64` 字段内联存储，需迁移到对象存储（本地文件实现）。

建议先做一次 dry-run：

```bash
npm run storage:migrate -- --dry-run
```

确认统计结果后正式执行：

```bash
npm run storage:migrate
```

说明：

- 覆盖表/文件：`learning_library_items`、`assignment_uploads`、`module_resources`、`course_files`
- DB 模式与 JSON fallback 均支持
- `LIBRARY_INLINE_FILE_CONTENT=false` / `FILE_INLINE_CONTENT=false` 时会在迁移后清空内联 base64，仅保留对象存储引用

## 8. 演示账号

以下账号默认可用于 `npm run dev` 的 local demo/dev 启动；若启用了 PostgreSQL，则以数据库种子与当前库内账号为准。

- 学生：`student@demo.com / Student123`
- 学生2：`student2@demo.com / Student123`
- 学生3：`student3@demo.com / Student123`
- 家长：`parent@demo.com / Parent123`
- 教师：`teacher@demo.com / Teacher123`
- 管理员：`admin@demo.com / Admin123`
- 学校管理员：通过 `/school/register` 自助创建，默认要求邀请码；仅在显式开启首个账号 bootstrap 开关时允许无邀请码初始化

批量数据（可选）：

```bash
SEED_TEACHERS=36 \
SEED_STUDENTS=432 \
SEED_PARENTS=180 \
SEED_CLASSES=36 \
SEED_ASSIGNMENTS=72 \
SEED_SUBJECTS="chinese,math,english" \
SEED_GRADES="1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,12,12,12" \
npm run seed:bulk
```

## 9. AI 多模型配置（重点）

### 9.1 支持的 provider

- `zhipu`
- `deepseek`
- `kimi`
- `minimax`
- `seedance`
- `compatible`
- `custom`
- `mock`

### 9.2 推荐配置示例（Kimi -> DeepSeek -> Zhipu）

```bash
LLM_PROVIDER_CHAIN=kimi,deepseek,zhipu,mock

KIMI_API_KEY=...
KIMI_MODEL=moonshot-v1-8k

DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat

ZHIPU_API_KEY=...
ZHIPU_MODEL=glm-4.7
```

### 9.3 重要机制

- 运行时链路优先级高于环境变量链路
- 如果在 `/admin/ai-models` 保存过链路，会覆盖 `LLM_PROVIDER_CHAIN`
- 需要切回环境变量时，在管理端执行“切回环境变量”

### 9.4 连通性与健康检查

- 管理端页面：`/admin/ai-models`
- 接口：
  - `GET /api/admin/ai/config`
  - `POST /api/admin/ai/test`
  - `GET /api/admin/ai/metrics`
  - `GET /api/admin/ai/evals`
  - `GET/POST /api/admin/ai/quality-calibration`
- 已支持 provider 健康状态与缺失环境变量诊断
- `quality-calibration` 支持灰度开关、快照历史与回滚操作

## 10. 关键页面与接口

### 10.1 页面

- 学生：`/practice`、`/wrong-book`、`/student/exams`、`/student/growth`
- 家长：`/parent`
- 教师：`/teacher`、`/teacher/exams`、`/teacher/analysis`
- 学校：`/school`、`/school/classes`、`/school/teachers`、`/school/students`
- 管理：`/admin`、`/admin/questions`、`/admin/knowledge-points`、`/admin/ai-models`
- 资料库：`/library`、`/library/[id]`

### 10.2 核心 API（分组）

- 认证与用户：`/api/auth/*`（含 `/api/auth/school-register`）
- 学校组织：`/api/school/overview`、`/api/school/classes`、`/api/school/users`
- 练习与掌握度：`/api/practice/*`、`/api/plan*`、`/api/student/radar`
- 错题复练：`/api/wrong-book*`
- 考试：`/api/teacher/exams*`、`/api/student/exams*`
- 教师预警：`/api/teacher/insights`、`/api/teacher/alerts*`
- 家长协同：`/api/report/weekly`、`/api/parent/assignments`、`/api/parent/action-items/receipt`
- 题库治理：`/api/admin/questions*`、`/api/admin/questions/quality*`
- AI 治理：`/api/admin/ai/config`、`/api/admin/ai/policies`、`/api/admin/ai/metrics`、`/api/admin/ai/test`、`/api/admin/ai/evals`、`/api/admin/ai/quality-calibration`
- 实验灰度：`/api/admin/experiments/*`
- 资料库：`/api/library*`、`/api/admin/library*`

## 11. 数据导入与演示资源

公开资源导入包：

- `docs/chinese-open-curriculum-pack.json`
- `docs/chinese-download-first-pack.json`

导入命令：

```bash
npm run import:open-curriculum
npm run import:open-curriculum -- docs/chinese-download-first-pack.json
```

若是 PostgreSQL 部署环境，建议用：

```bash
npm run seed:library-db
```

## 12. 测试与 CI

本地质量门槛：

```bash
npm run verify:strict
```

CI 工作流：`.github/workflows/ci.yml`

- workflow-lint
- strict-verify（执行 `npm run verify:strict`，顺序包含 `lint + build + test:unit + test:api + test:browser:built`）
- production-like-regression（PostgreSQL + 对象存储根路径 + `ALLOW_JSON_FALLBACK=false` 下顺序执行 `test:smoke:production-like`、`test:browser:production-like` 与 `test:school-schedules:production-like`）
- verify（强制汇总校验）
- `npm test` 当前仍保留为快速门：`test:unit + test:api`
- 本地发布前建议执行：`npm run verify:strict`
- 本地要复现 CI 的 DB/object-storage 路径时，执行：`npm run test:smoke:production-like:local`
- 本地要复现 CI 的 DB/object-storage 浏览器路径时，执行：`npm run test:browser:production-like:local`
- 学校排课 AI 预演 / 应用 / 回滚的深 API 回归，可执行：`npm run test:school-schedules:production-like:local`
- 低内存 Linux 主机发布，优先使用预构建脚本而不是远端 `next build`：

```bash
DEPLOY_REMOTE_HOST=root@8.136.122.236 \
DEPLOY_EXTERNAL_HEALTH_URL=https://8.136.122.236/api/health \
npm run deploy:remote:prebuilt
```

- 这条脚本默认先本地 `npm run build`，然后上传预构建包到远端，只在服务器执行 `npm ci --omit=dev`、`db:migrate`、PM2 canary 和切流
- 提交到主干后的 CI 还会再跑一遍 production-like 三层回归，先验证最小 smoke，再验证浏览器 smoke 与学校排课深回归
- 已部署环境发布后建议执行：

```bash
API_TEST_BASE_URL=https://your-env.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
npm run test:smoke:remote
```

- 远端 smoke 当前除健康检查和学生认证链路外，还会验证管理员登录与学校课表只读拉取
- 远端 smoke 默认使用 `admin@demo.com / Admin123` 与 `school-default`；可通过 `API_TEST_ADMIN_EMAIL`、`API_TEST_ADMIN_PASSWORD`、`API_TEST_SMOKE_SCHOOL_ID` 覆盖
- 可通过手工工作流 `.github/workflows/release-smoke.yml` 对 staging / production 执行远端 smoke
- 首次运行浏览器测试前，需要先执行一次：`npx playwright install --with-deps chromium`

## 13. Render 部署建议

1. 创建 Web Service + PostgreSQL
2. 配置环境变量：`DATABASE_URL`、`DB_SSL=true`、`REQUIRE_DATABASE=true`、`ALLOW_JSON_FALLBACK=false`、`MASTERY_INCREMENTAL_ENABLED=true`、`UNIFIED_REVIEW_ENGINE=true`、AI keys、`LLM_PROVIDER_CHAIN`、`AI_POLICY_ENFORCE=true`
   生产巡检建议同时配置：`READINESS_PROBE_TOKEN`
3. 首次部署执行：

```bash
npm run db:init
npm run seed:base
npm run seed:stage3
npm run seed:library-db
```

4. 版本升级执行：

```bash
npm run db:migrate
```

5. 开启 `UNIFIED_REVIEW_ENGINE=true` 后，历史 `wrong_review_items` 与 `memory_reviews` 会在用户读取复练数据时懒回填到 `review_tasks`，发布窗口建议完整执行 `npm run verify:strict`。

6. 登录管理端 `/admin/ai-models` 校验模型链与健康状态

## 14. 目录结构

- `app/` 页面与 API 路由
- `lib/` 核心业务逻辑与数据访问
- `db/` SQL schema
- `scripts/` 初始化、种子、导入、导出、回归脚本
- `docs/` 周计划、验收清单、导入模板
- `data/` JSON fallback 数据

## 15. 运营与治理文档索引

索引更新：2026-03-17

- `docs/project-readiness-index.md`
  用途：先看当前项目状态、规模指标、主要风险，以及“该跳去哪份文档”。
- `docs/development-checklist.md`
  用途：看全项目复评结论、开发硬规则和 90 天执行清单。
- `docs/p0-productization-checklist.md`
  用途：看 P0 阻断项、当前基线和本轮必须完成的验收口径。
- `docs/runtime-state-inventory.md`
  用途：看 JSON / DB / 对象存储边界，确认哪些运行时状态已经 DB-only，以及当前工作树 `data/` 目录下可见的 `23` 个文件如何对应 DB canonical path。
- `docs/strict-testing-baseline.md`
  用途：看 `verify:strict`、browser smoke、production-like regression、CI 测试门。
- `docs/staging-production-release-runbook.md`
  用途：看 staging / production 发布、预构建远端发布脚本、远端 smoke、失败回滚与手工工作流。
- `docs/p0-optimization-task-cards.md`
  用途：把 P0 收口工作直接拆成 issue / task card。
- `docs/week7-challenge-regression-checklist.md`
  用途：看 challenge 专项回归检查点。
- `docs/week8-gray-release-runbook.md`
  用途：看灰度发布的阶段性 runbook。
- `docs/week9-task-cards.md`
  用途：看周度任务拆分参考。

## 16. 免责声明

- 本项目中的公开教材/课件资源用于产品能力演示
- 真实生产使用请遵循源站许可与版权条款
- AI 输出仅作辅助，关键教学决策应保留人工审核
