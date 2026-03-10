# 航科（K12 AI 教育平台）

面向 K12 的 AI 教育产品原型，覆盖学生、教师、家长、学校管理员、平台管理员五端，围绕“诊断 -> 计划 -> 练习 -> 复练 -> 干预 -> 反馈 -> 验证”的提分闭环构建。

更新时间：2026-03-01

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

近期新增（2026-03-01）：

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
- [x] traceId 贯穿 API 响应头与 AI 调用日志（便于跨链路排障）
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

### P0（高优先，稳定性与可维护性）

1. AI 内核拆层（provider adapter / policy engine / task handlers）
2. 文件内容迁移到对象存储（已覆盖资料库/作业上传/模块资源/课程文件，含迁移脚本）
3. 显式 migration 机制替代运行时自动建表（已落地 `db:migrate`）
4. 统一授权中间层（角色 + 资源归属 + 班级关系，V1 已落地）
5. 测试分层（单测 + API 回归 + E2E 关键链路）
6. 可观测性增强（traceId 串联业务和 AI 日志，V1 已落地）

### P1（次优先，提分效果增强）

1. 掌握度引擎 V2（时间衰减、难度权重、置信度）
2. 教师干预自动化（共性错因 -> 讲评包 -> 作业 -> 通知）
3. 家长执行效果关联分析（执行 -> 学习变化）
4. RAG 质量评测与引用可信度治理
5. 套餐订阅最小闭环

### P2（中期，形成差异化）

1. 学生 AI 教练长期记忆
2. 自适应考试与能力诊断增强
3. 学校组织能力 V2（多校区、多学校管理员协同、跨校运营面板）

## 5.1 推到产品级的关键改进空间

当前项目已经具备完整业务闭环，更接近“可演示、可试运行的产品原型”，距离真正的产品级主要还差运行治理、质量门与交付体系的系统化建设。

### P0（上线前必须完成）

1. 生产环境强制 PostgreSQL + 对象存储，关闭生产 JSON fallback
2. 会话、登录限流、关键状态统一收口到 DB/缓存层，降低多实例一致性风险
3. 补齐 CSRF / Origin 校验、管理员 2FA、异常登录告警、找回流程防滥用
4. 将 `npm test` 纳入 CI 必跑项，并补关键链路 E2E、权限回归、并发写入回归
5. 建立 staging / production 双环境发布链路：迁移、健康检查、发布后 smoke、失败回滚
6. 接入外部错误追踪、日志聚合、告警与基础 SLO，而不是仅依赖应用内日志

### 数据与存储治理

1. 预发/生产环境要求 `DATABASE_URL`，仅本地开发允许 JSON fallback
2. 为 migration 增加版本审计、回滚策略、索引检查和备份恢复演练
3. 将 session、限流、审计等高频状态逐步从文件实现迁移到更稳定的持久化方案
4. 建立容量治理：日志上限、历史归档、对象存储生命周期、冷数据清理

### 安全与权限治理

1. 把当前角色校验升级为更完整的权限矩阵，覆盖角色、租户、资源归属、班级关系
2. 为多租户和越权访问建立专项回归测试，尤其是跨学校、跨班级、跨角色场景
3. 增加敏感操作二次确认、管理员操作留痕增强和高风险行为告警
4. 补充设备管理、异地/异常登录识别、密码策略升级与恢复链路审计

### 测试与质量门

1. 在 API 集成测试外，补充 `lib/*` 关键领域逻辑单测
2. 增加学生、教师、家长、学校管理员的关键 E2E 流程覆盖
3. 为存储一致性、对象存储迁移、权限边界、恢复流程建立回归样例
4. 为高风险发布增加 smoke checklist，避免“能构建但不能用”

### 可观测性与运维

1. 在现有 traceId、埋点和 API 指标基础上，接入外部监控平台
2. 建立错误告警、慢接口榜单、AI 调用失败率告警、关键漏斗异常告警
3. 明确基础 SLO，例如登录成功率、核心 API 可用性、AI 生成成功率、考试提交流程成功率
4. 补充发布后巡检、值班排障、事故复盘和审计导出机制

### 交付与部署体系

1. 补齐容器化/部署描述、环境变量校验、初始化脚本与部署文档
2. 将数据库迁移、对象存储配置、健康检查纳入标准部署流程
3. 区分演示数据、测试数据、真实学校数据，避免环境串用
4. 形成“开发 -> 预发 -> 生产”的标准变更路径，而不是本地可跑即发布

### AI 治理与发布门禁

1. 将离线评测、质量校准、灰度发布正式纳入上线门禁
2. 增加 prompt/version 管理、预算控制、PII 脱敏和高风险输出人工复核
3. 为各 provider 建立 SLA、超时、降级与回退策略，而不是仅做调用回退
4. 为不同任务类型设定最低质量分、失败兜底话术与人工接管路径

### 合规与隐私

1. 面向 K12/未成年人场景补充数据最小化、留存周期、删除导出、家长授权机制
2. 明确审计日志保留周期、敏感字段脱敏范围与密钥管理策略
3. 对埋点、AI 输入输出、学习记录建立分级访问与最小权限原则

### 产品体验与运营化

1. 做系统性的移动端回归、无障碍检查、加载态/空态/失败态统一治理
2. 为关键页面设定性能预算和真实设备体验基线
3. 增加新用户引导、角色首登引导和关键功能 discoverability 优化
4. 把埋点漏斗真正接到产品运营动作上，形成“发现问题 -> 验证原因 -> 灰度改进 -> 复盘”的闭环

### 当前最优先的三件事

1. 生产环境彻底切换到 DB + 对象存储，去掉生产 JSON fallback
2. 补齐 CSRF / 2FA / 权限回归，并把 `npm test` 接入 CI
3. 建立标准化发布链路和外部监控告警，确保可上线、可回滚、可定位

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

### 7.1 本地启动（JSON 模式）

```bash
npm install
npm run dev
```

访问：`http://localhost:3000`

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

- 学生：`student@demo.com / Student123`
- 学生2：`student2@demo.com / Student123`
- 学生3：`student3@demo.com / Student123`
- 家长：`parent@demo.com / Parent123`
- 教师：`teacher@demo.com / Teacher123`
- 管理员：`admin@demo.com / Admin123`
- 学校管理员：通过 `/school/register` 自助创建（可配置邀请码）

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
npm run lint
npm run build
npm run test:api
```

CI 工作流：`.github/workflows/ci.yml`

- workflow-lint
- lint
- build
- verify（强制汇总校验）
- `npm run test:api` 当前仍作为本地发布前必跑项，暂未接入 GitHub CI 必过校验

## 13. Render 部署建议

1. 创建 Web Service + PostgreSQL
2. 配置环境变量：`DATABASE_URL`、`DB_SSL=true`、`REQUIRE_DATABASE=true`、`ALLOW_JSON_FALLBACK=false`、`MASTERY_INCREMENTAL_ENABLED=true`、`UNIFIED_REVIEW_ENGINE=true`、AI keys、`LLM_PROVIDER_CHAIN`、`AI_POLICY_ENFORCE=true`
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

5. 开启 `UNIFIED_REVIEW_ENGINE=true` 后，历史 `wrong_review_items` 与 `memory_reviews` 会在用户读取复练数据时懒回填到 `review_tasks`，发布窗口仍建议完整执行 `npm run lint`、`npm run build`、`npm run test:api`。

6. 登录管理端 `/admin/ai-models` 校验模型链与健康状态

## 14. 目录结构

- `app/` 页面与 API 路由
- `lib/` 核心业务逻辑与数据访问
- `db/` SQL schema
- `scripts/` 初始化、种子、导入、导出、回归脚本
- `docs/` 周计划、验收清单、导入模板
- `data/` JSON fallback 数据

## 15. 运营与治理文档

- `docs/p0-optimization-task-cards.md`
- `docs/week7-challenge-regression-checklist.md`
- `docs/week8-gray-release-runbook.md`
- `docs/week9-task-cards.md`

## 16. 免责声明

- 本项目中的公开教材/课件资源用于产品能力演示
- 真实生产使用请遵循源站许可与版权条款
- AI 输出仅作辅助，关键教学决策应保留人工审核
