# 星光课后 AI 辅导 MVP

小学课后辅导 Web MVP，聚焦人教版语文/数学/英语。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000

## 演示账号

- 学生：student@demo.com / Student123
- 学生2：student2@demo.com / Student123
- 学生3：student3@demo.com / Student123
- 家长：parent@demo.com / Parent123
- 教师：teacher@demo.com / Teacher123
- 管理员：admin@demo.com / Admin123

### 批量测试账号（seed-bulk.mjs）

执行 `node scripts/seed-bulk.mjs` 后，会生成一批可用账号与班级数据。默认示例：

- 教师：teacher1@demo.com / Teacher123
- 学生：student1@demo.com / Student123
- 家长：parent1@demo.com / Parent123
- 班级邀请码示例：JOIN01 / JOIN02 / JOIN03

可通过环境变量控制数量：

```
SEED_TEACHERS=3 SEED_STUDENTS=40 SEED_PARENTS=12 \
SEED_CLASSES=6 SEED_ASSIGNMENTS=12 \
SEED_SUBJECTS="math,chinese,english" SEED_GRADES="4,7,10" \
node scripts/seed-bulk.mjs
```

## 注册入口

- 学生/家长注册：/register
- 教师注册：/teacher/register
- 管理员注册：/admin/register
- 家长注册需要填写绑定学生邮箱
- 若配置 `TEACHER_INVITE_CODE` 或 `ADMIN_INVITE_CODE`，注册需要邀请码

## 功能详解

### 学生端（提分主链路）

- 诊断测评与学习计划：支持按学科发起诊断，自动生成学习计划，并可通过 `/api/plan/refresh` 动态刷新。
- 多模式练习：普通、闯关、限时、错题专练、自适应推荐、记忆复习六类模式，覆盖日常巩固到考前冲刺。
- 掌握度驱动推荐：每次提交练习后更新知识点掌握度（`masteryScore` / `masteryDelta`），后续练习优先薄弱点。
- 错题闭环复练：错题自动进入 24h/72h/7d 复练队列，学生在“今日复练清单”完成再练并更新间隔。
- AI 学习支持：提供错题讲解、变式训练、学习陪练（分步提示+追问）、AI 对话辅导。
- 学习结果可视化：学生可查看能力雷达、成长档案、学习路径、学科薄弱点变化。
- 挑战动机系统 2.0：挑战任务与薄弱点修复绑定，领取奖励前必须满足学习证明（非纯打卡）。

### 家长端（可执行协同）

- 家长注册绑定学生后可查看学习进度、作业状态、错题与复练状态。
- 周报不仅展示数据，还给出行动建议：`actionItems`、`estimatedMinutes`、`parentTips`。
- 行动卡支持执行回执（完成/跳过+原因），并展示完成率、待执行数与净效果分。
- 可查看需跟进任务（作业提醒、订正提醒），降低“看不懂报告、无法陪学”的成本。

### 教师端（教学闭环）

- 班级管理：创建班级、邀请码入班、审核申请、学生列表维护。
- 作业全流程：发布作业、查看完成率、批改与评语、错因标签、上传附件。
- 学情洞察：班级分析、知识点热力图、趋势报告、重点提醒。
- 风险预警：教师可查看风险学生/风险知识点/建议动作，并对告警执行确认（ack）。
- 教师 AI 工具：AI 组卷、讲稿生成、错题讲评课脚本，并支持从讲评包一键布置课后复练作业。
- AI 结果质控：讲稿/讲评脚本/讲评包输出附带置信度、风险等级与人工复核建议。

### 管理员端（平台运营与治理）

- 题库治理：单题/批量 AI 出题、CSV 导入、题目纠错、质量评分与风险标签（重复/歧义/答案一致性），支持隔离池/风险级别/答案冲突/重复簇筛选。
- 题库治理看板：展示高风险数、答案冲突数、隔离池规模与重复簇 Top 列表，支持一键按簇筛查。
- 知识点治理：知识点树生成、批量预览导入、结构化维护（学科-年级-单元-知识点）。
- AI 路由治理：模型链配置 + 任务级策略（超时/重试/预算/质量阈值）+ 调用指标看板。
- 运营看板：核心漏斗（登录→练习→提交→复练→周报查看）与关键行为埋点。
- A/B 与灰度：实验开关、分流比例、实验报告、放量建议，支持快速回滚。
- 审计能力：管理员操作日志记录关键变更动作。

### 学习闭环（端到端）

1. 诊断：确定起点与薄弱项。  
2. 计划：按知识点和掌握度生成学习任务。  
3. 练习：提交后立即产出正确性、掌握度增量和推荐方向。  
4. 复练：错题进入间隔复习队列并持续追踪复练结果。  
5. 激励：挑战任务绑定学习证明，推动“练习-复盘-修复”闭环。  
6. 反馈：学生看成长、教师看风险、家长看行动建议。  
7. 运营：管理员通过 A/B 验证效果并灰度放量。  

## 关键页面与接口（示例）

- 学生端页面：`/practice`、`/wrong-book`、`/challenge`、`/student/growth`、`/report`
- 家长端页面：`/parent`
- 教师端页面：`/teacher`、`/teacher/analysis`、`/teacher/gradebook`
- 管理端页面：`/admin`、`/admin/questions`、`/admin/knowledge-points`、`/admin/experiments`
- 核心 API：
  - AI 策略治理：`/api/admin/ai/config`、`/api/admin/ai/policies`、`/api/admin/ai/metrics`、`/api/admin/ai/test`
  - 练习与掌握度：`/api/practice/next`、`/api/practice/submit`、`/api/plan`、`/api/student/radar`
  - 教材 RAG：`/api/library/index`、`/api/library/retrieve`
  - 考试测评闭环：`/api/teacher/exams`、`/api/teacher/exams/[id]`、`/api/teacher/exams/[id]/review-pack/publish`、`/api/student/exams/[id]/submit`、`/api/student/exams/[id]/review-pack`
  - 错题复练：`/api/wrong-book`、`/api/wrong-book/review-queue`、`/api/wrong-book/review-result`
  - 教师预警：`/api/teacher/insights`、`/api/teacher/alerts`、`/api/teacher/alerts/[id]/ack`
  - 家长周报：`/api/report/weekly`、`/api/parent/assignments`
  - 实验发布：`/api/admin/experiments/flags`、`/api/admin/experiments/ab-report`

## 已实现能力清单

- [x] 账号体系（学生/家长/教师/管理员）
- [x] 诊断测评 + 学习计划 + 动态刷新
- [x] 练习模式（普通/闯关/限时/错题/自适应/记忆复习）
- [x] 知识点掌握度（`masteryScore`/`masteryDelta`）与薄弱点优先推荐
- [x] 错题闭环（24h/72h/7d 间隔复练队列）
- [x] AI 错题讲解 + 变式训练 + 学习陪练
- [x] AI 辅导（对话/提示/步骤）
- [x] 语音朗读评测（语文/英语）
- [x] 作文/写作批改（结构/语法/词汇）
- [x] 学习画像/能力雷达/成长档案
- [x] 挑战任务系统（学习证明校验 + 奖励积分）
- [x] 班级与作业（发布/完成/批改/统计）
- [x] 学生自助入班（邀请码 + 审核）
- [x] 教师学情分析（热力图/报告/风险提醒）
- [x] 家长周报行动化输出（行动卡 + 预计时长 + 陪学建议）
- [x] 题库管理（CSV 导入/AI 生成/纠错/质量评分）
- [x] 知识点树管理（批量导入/树形可视化/AI 生成）
- [x] 运营埋点与漏斗分析
- [x] A/B 实验与灰度发布能力
- [x] 管理端操作日志
- [x] AI 多模型链路 + 任务级策略 + 调用指标
- [x] 教材分块检索（RAG）+ 讲解/教案引用依据
- [x] 考试风险识别（风险分/原因/建议动作）+ 教师一键发布高风险复盘任务（支持家长协同通知）
- [ ] 付费套餐与订阅

## 系统架构图（文字版）

```text
┌───────────────────────────────┐
│           Client 层            │
│ 浏览器（学生/家长/教师/管理员） │
└───────────────┬───────────────┘
                │ HTTP / Cookie Session
┌───────────────▼───────────────┐
│       Next.js App Router       │
│ 页面路由: app/*                │
│ API路由: app/api/*             │
└───────────────┬───────────────┘
                │ 调用
┌───────────────▼───────────────┐
│         业务服务层 lib/*        │
│ auth/guard（鉴权与角色）         │
│ practice/progress/mastery      │
│ wrong-book（错题复练）           │
│ challenges/experiments（激励+A/B）│
│ report/insights/admin-log      │
└───────────────┬───────────────┘
                │ 读写
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
                │（可选）
      ┌─────────▼─────────┐
      │ 外部 LLM Provider │
      │ zhipu / custom    │
      └───────────────────┘
```

架构要点：
- 页面与 API 同仓，前后端在 Next.js 内聚，便于快速迭代。
- 业务逻辑集中在 `lib/*`，API 层负责鉴权、参数校验、编排与返回。
- 数据层支持双模式：生产推荐 PostgreSQL，本地可用 `data/*.json` 快速演示。
- AI 能力为可插拔，不影响核心学习链路可用性。

## 数据流图（文字版）

### 1) 学生练习与掌握度更新

```text
学生进入 /practice
  -> POST /api/practice/next 获取题目
  -> POST /api/practice/submit 提交答案
      -> 写入 question_attempts
      -> 更新 mastery_records（masteryScore/masteryDelta）
      -> 错题则写入/更新 wrong_review_items（nextReviewAt/intervalLevel）
  -> GET /api/plan 与 GET /api/student/radar 消费最新掌握度
```

### 2) 错题闭环（间隔复习）

```text
学生进入 /wrong-book
  -> GET /api/wrong-book/review-queue 拉取当日应复练题
  -> POST /api/wrong-book/review-result 提交复练结果
      -> 更新 wrong_review_items 的 intervalLevel/nextReviewAt/lastReviewResult
      -> 同步产生新的练习记录，影响 mastery 与后续推荐
```

### 3) 挑战系统 + A/B 灰度

```text
学生请求 GET /api/challenges
  -> lib/experiments 按 hash(userId,key)%100 分桶
  -> control: 旧挑战规则
  -> treatment: 薄弱点学习闭环规则（含 learningProof）
  -> 返回 tasks + experiment

学生 POST /api/challenges/claim
  -> 校验 completed + learningProof
  -> 写入 challenge_claims（含 linked_knowledge_points/learning_proof/unlock_rule）
  -> 返回最新积分与任务状态
```

### 4) 教师预警与家长周报

```text
练习/作业/复练数据沉淀
  -> 教师端 GET /api/teacher/insights + /api/teacher/alerts 生成风险视图
  -> 家长端 GET /api/report/weekly + /api/parent/assignments 生成行动建议
```

### 5) 管理端实验发布闭环

```text
管理员 /admin/experiments
  -> GET /api/admin/experiments/flags 查看开关
  -> POST /api/admin/experiments/flags 调整 enabled/rollout
  -> GET /api/admin/experiments/ab-report 查看留存/正确率/复练完成率差异
  -> 按 recommendation 执行放量、保持或回滚
```

## 数据库接入

项目支持 PostgreSQL。配置步骤：

1. 创建数据库并执行 `db/schema.sql`
2. 设置环境变量：

```
DATABASE_URL=postgres://user:password@host:5432/dbname
DB_SSL=false
ADMIN_INVITE_CODE=可选
TEACHER_INVITE_CODE=可选
ADMIN_BOOTSTRAP_EMAIL=可选
ADMIN_BOOTSTRAP_PASSWORD=可选
ADMIN_BOOTSTRAP_NAME=可选
```

3. 可选：导入示例数据

```
node scripts/seed-db.mjs
```

4. 阶段三测试数据（班级/作业/批改/成长档案）

```
node scripts/seed-stage3.mjs
```

5. 批量测试数据（多账号/多班级/多作业）

```
node scripts/seed-bulk.mjs
```

6. 导入教材/课件演示资源到数据库（部署后直接可见）

```
npm run seed:library-db
```

> 若设置了 `DATABASE_URL` 则写入数据库，否则写入 `data/*.json`。

### Render 快速接入

1. 在 Render 创建 PostgreSQL 服务
2. 将连接串配置为环境变量 `DATABASE_URL`
3. 进入 Render Shell 或本地执行：

```
npm run db:init
npm run seed:base
npm run seed:stage3
npm run seed:library-db
```

4. 如需批量演示数据（线上环境推荐）：

```
SEED_TEACHERS=36 \
SEED_STUDENTS=432 \
SEED_PARENTS=180 \
SEED_CLASSES=36 \
SEED_ASSIGNMENTS=72 \
SEED_SUBJECTS="chinese,math,english" \
SEED_GRADES="1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,12,12,12" \
npm run seed:bulk
```

以上参数可生成每个年级每个学科对应班级与教师，并保证每个班级有 12 名学生。

启用数据库后，系统将不再读取 `data/*.json`。

## AI 配置（可选）

默认使用 `mock`。现在已支持多模型切换与回退链：
- `zhipu`
- `deepseek`
- `kimi`
- `minimax`
- `seedance`
- `compatible`（OpenAI 兼容接口）
- `custom`（自定义 prompt 接口）

单模型示例（智谱）：

```
LLM_PROVIDER=zhipu
LLM_API_KEY=你的智谱API Key
LLM_MODEL=glm-4.7
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_CHAT_PATH=/chat/completions
```

多模型回退示例（按顺序自动降级）：

```
LLM_PROVIDER_CHAIN=zhipu,deepseek,kimi,minimax,seedance
ZHIPU_API_KEY=...
DEEPSEEK_API_KEY=...
KIMI_API_KEY=...
MINIMAX_API_KEY=...
SEEDANCE_API_KEY=...
```

Provider 专属变量（推荐）：
- `ZHIPU_*`
- `DEEPSEEK_*`
- `KIMI_*`
- `MINIMAX_*`
- `SEEDANCE_*`

通用变量兼容保留（主要用于 `zhipu/compatible`）：`LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL`、`LLM_CHAT_PATH`。

若使用自定义接口：

```
LLM_PROVIDER=custom
LLM_ENDPOINT=你的模型接口
LLM_API_KEY=可选
```

## 目录

- app/ 页面与 API 路由
- components/ UI 组件
- data/ 示例知识点与题库
- lib/ 类型与工具
- docs/ 验收清单与发布手册

## 公开教材/课件导入（演示资源）

项目已提供一份中文全学科公开资源导入包（教材 + 课件）：

- 导入包：`docs/chinese-open-curriculum-pack.json`
- 下载优先包（PDF/PPT/DOC/ZIP 直链）：`docs/chinese-download-first-pack.json`
- 导入脚本：`scripts/import-open-curriculum-pack.mjs`

一键导入到运行时数据（管理端可见）：

```bash
npm run import:open-curriculum
```

导入下载优先包：

```bash
npm run import:open-curriculum -- docs/chinese-download-first-pack.json
```

若是 PostgreSQL 部署环境，建议改用数据库种子命令（写入 DB，不是 `.runtime-data`）：

```bash
npm run seed:library-db
```

导入后可在 `/library` 的管理端资源库查看。  
说明：
- 当前导入包优先使用公开入口资源（Wikibooks、国家智慧教育平台）。
- 资源链接用于产品能力演示，具体使用需遵循源站条款与版权声明。

## 验收与发布文档

- Week7 回归验收清单：`docs/week7-challenge-regression-checklist.md`
- Week8 灰度发布手册：`docs/week8-gray-release-runbook.md`

## 下一步

- 接入真实题库与知识点树
- 连接 AI 模型与检索系统
- 上线家长周报生成与自动推送
