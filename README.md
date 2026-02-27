# HK-AI-EDU（星光课后 AI 教育平台）

面向 K12 的 AI 教育产品原型，覆盖学生、教师、家长、管理员四端，围绕“诊断 -> 练习 -> 复练 -> 干预 -> 反馈”的提分闭环构建。

更新时间：2026-02-27

## 1. 项目定位

HK-AI-EDU 不是单点工具，而是一个完整的学习运营系统：

- 学生端：练习、错题复练、考试测评、成长画像、AI 陪练
- 教师端：班级作业、考试组卷、预警干预、讲评包、AI 教案/课件
- 家长端：周报行动卡、执行回执、效果跟踪
- 管理端：题库治理、知识点治理、AI 模型路由、A/B 灰度、操作审计

核心目标：

- 提升“有效学习结果”而不是仅提升使用时长
- 把 AI 从“生成内容”升级到“可治理、可观测、可回滚”
- 支持从演示环境平滑迁移到数据库部署

## 2. 功能全景

### 2.1 学生端（提分主链路）

- 诊断测评与学习计划（支持动态刷新 `/api/plan/refresh`）
- 多模式练习：普通、闯关、限时、错题、自适应、记忆复习
- 掌握度机制：`masteryScore` / `masteryDelta` / 薄弱点优先推荐
- 错题闭环：24h/72h/7d 间隔复练队列
- 在线考试：老师发布、学生完成、自动入错题复练队列
- AI 学习支持：错题讲解、变式训练、对话陪练、写作批改
- 成长可视化：能力雷达、成长档案、学习任务总览

### 2.2 教师端（教学闭环）

- 班级与学生管理：创建班级、邀请码入班、审批入班申请
- 作业闭环：发布、批改、统计、错因标签、附件上传
- 考试闭环：组卷、发布、防作弊事件、成绩导出、讲评包发布
- 风险预警：风险学生/风险知识点/建议动作
- 预警动作：一键布置修复任务、一键通知学生、一键确认处理
- AI 教学工具：教案/课件生成、讲评顺序与复练单辅助

### 2.3 家长端（执行闭环）

- 周报行动化输出：`actionItems`、`estimatedMinutes`、`parentTips`
- 家长行动回执：完成/跳过（含原因）与连续执行天数
- 执行效果量化：completionRate、effect score、近 7 天趋势

### 2.4 管理端（运营与治理）

- 题库治理：导入、生成、质量评分、重复簇、答案冲突、隔离池
- 知识点治理：树结构导入、AI 生成、批量预览与修正
- AI 路由治理：多模型链、任务级策略、预算/质量阈值、调用指标
- AI 健康诊断：每个 provider 的配置状态和缺失环境变量提示
- 实验治理：A/B 开关、分流比例、结果报告、灰度与回滚
- 审计：关键操作落管理员日志

## 3. 学习闭环（业务主流程）

1. 诊断：确定薄弱知识点与初始能力
2. 计划：按掌握度生成可执行任务
3. 练习：提交即更新掌握度并给出解释
4. 复练：错题自动进入间隔复习队列
5. 干预：教师预警触发并下发修复动作
6. 协同：家长按行动卡执行并回执
7. 验证：通过 A/B 与指标看板评估效果

## 4. 已实现能力清单

- [x] 账号体系（学生/家长/教师/管理员）
- [x] 认证安全（登录限流、密码策略、旧密码迁移）
- [x] 学习计划与掌握度增量更新
- [x] 错题闭环与间隔复习队列
- [x] 在线考试（教师发布、学生提交、防作弊事件、导出）
- [x] 考试错题自动入复练队列
- [x] 挑战系统 2.0（学习证明校验）
- [x] 教师风险预警 + 一键动作 + 影响追踪
- [x] 家长行动回执闭环
- [x] 题库质量治理 V2（重复簇、歧义、答案一致性、隔离池）
- [x] 教材/课件/教案资料库（导入、阅读、标注、分享、分学科管理）
- [x] 资料库列表轻载 + 详情重载 + 服务端分页筛选
- [x] 资料库文件对象存储适配（文件内容可脱离 DB 存储，DB 仅保留元数据）
- [x] AI 多模型路由（zhipu/deepseek/kimi/minimax/seedance/compatible/custom）
- [x] AI 任务策略（providerChain、timeout、retries、budget、minQualityScore）
- [x] AI 配置与日志 DB 优先存储（多实例一致）
- [x] 运营埋点漏斗 + A/B 灰度发布
- [ ] 付费套餐与订阅

## 5. 当前迭代路线图（ROI 优先）

### P0（高优先，稳定性与可维护性）

1. AI 内核拆层（provider adapter / policy engine / task handlers）
2. 文件内容迁移到对象存储（已覆盖资料库/作业上传/模块资源/课程文件，含迁移脚本）
3. 显式 migration 机制替代运行时自动建表
4. 统一授权中间层（角色 + 资源归属 + 班级关系）
5. 测试分层（单测 + API 回归 + E2E 关键链路）
6. 可观测性增强（traceId 串联业务和 AI 日志）

### P1（次优先，提分效果增强）

1. 掌握度引擎 V2（时间衰减、难度权重、置信度）
2. 教师干预自动化（共性错因 -> 讲评包 -> 作业 -> 通知）
3. 家长执行效果关联分析（执行 -> 学习变化）
4. RAG 质量评测与引用可信度治理
5. 套餐订阅最小闭环

### P2（中期，形成差异化）

1. 学生 AI 教练长期记忆
2. 自适应考试与能力诊断增强
3. 机构版多租户能力（多校区/多管理员/数据隔离）

## 6. 技术架构（文字版）

```text
┌───────────────────────────────┐
│           Client 层            │
│ 浏览器（学生/家长/教师/管理员） │
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
│ auth / practice / mastery      │
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
```

2. 初始化数据库并写入种子：

```bash
npm run db:init
npm run seed:base
npm run seed:stage3
npm run seed:library-db
```

说明：

- 配置 `DATABASE_URL` 后，系统走 DB，不再读取 `data/*.json`
- 未配置 `DATABASE_URL` 时使用 JSON fallback

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
- 已支持 provider 健康状态与缺失环境变量诊断

## 10. 关键页面与接口

### 10.1 页面

- 学生：`/practice`、`/wrong-book`、`/student/exams`、`/student/growth`
- 家长：`/parent`
- 教师：`/teacher`、`/teacher/exams`、`/teacher/analysis`
- 管理：`/admin`、`/admin/questions`、`/admin/knowledge-points`、`/admin/ai-models`
- 资料库：`/library`、`/library/[id]`

### 10.2 核心 API（分组）

- 认证与用户：`/api/auth/*`
- 练习与掌握度：`/api/practice/*`、`/api/plan*`、`/api/student/radar`
- 错题复练：`/api/wrong-book*`
- 考试：`/api/teacher/exams*`、`/api/student/exams*`
- 教师预警：`/api/teacher/insights`、`/api/teacher/alerts*`
- 家长协同：`/api/report/weekly`、`/api/parent/assignments`、`/api/parent/action-items/receipt`
- 题库治理：`/api/admin/questions*`、`/api/admin/questions/quality*`
- AI 治理：`/api/admin/ai/config`、`/api/admin/ai/policies`、`/api/admin/ai/metrics`、`/api/admin/ai/test`
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
- api-tests
- build
- verify（强制汇总校验）

## 13. Render 部署建议

1. 创建 Web Service + PostgreSQL
2. 配置环境变量：`DATABASE_URL`、`DB_SSL=true`、AI keys、`LLM_PROVIDER_CHAIN`
3. 首次部署执行：

```bash
npm run db:init
npm run seed:base
npm run seed:stage3
npm run seed:library-db
```

4. 登录管理端 `/admin/ai-models` 校验模型链与健康状态

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
