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

## 功能概览

- 多学科学习计划与诊断 + 动态刷新
- 练习模式：普通 / 闯关 / 限时 / 错题专练 / 自适应推荐 / 记忆复习
- AI 错题讲解 + 变式训练
- 学习陪练模式（分步提示 + 卡点追问）
- 朗读跟读评分（语文/英语）
- 作文/英语写作批改（结构/语法/词汇）
- 学习画像/能力雷达（算数/阅读/逻辑等维度）
- 竞赛/闯关式任务系统（挑战 + 奖励积分）
- AI 题库：单题/批量出题、CSV 导入、题库纠错
- AI 知识点树：整本书生成、批量预览后导入
- 班级与作业：发布作业、完成情况、作业批改、错题复盘
- 班级邀请码：学生自助加入 + 教师审核
- 课程模块与资源：章节结构、课件/链接资源、作业关联模块
- 通知中心：学生/家长通知
- 家长周报：作业提醒 + 订正任务提醒
- 成长档案：学习路径、学科掌握、薄弱点
- 成绩册：班级成绩分布/趋势 + CSV 导出
- 教师 AI 工具：AI 组卷 / 课堂讲稿 / 错题讲评课脚本
- 班级学情分析：知识点掌握热力图 + 学情报告
- 管理端操作日志

## 功能清单

- [x] 账号体系（学生/家长/教师/管理员）
- [x] 诊断测评 + 学习计划
- [x] 练习模式（普通/闯关/限时/错题/自适应/记忆复习）
- [x] AI 错题讲解 + 变式训练
- [x] 学习陪练模式（分步提示/卡点追问）
- [x] AI 辅导（对话/提示/步骤）
- [x] 知识点管理（批量导入/树形可视化/AI 生成）
- [x] 题库管理（CSV 导入/AI 生成/题型标签/题库纠错）
- [x] 班级与作业（发布/完成情况/统计看板）
- [x] 学生自助加入班级（邀请码/审核）
- [x] 作业批改与错题复盘（老师点评/错因标签）
- [x] 课程模块与资源（章节结构/课件/链接/作业关联）
- [x] 通知中心（学生/家长）
- [x] 家长周报与作业提醒
- [x] 成长档案（学习路径/薄弱点）
- [x] 成绩册（分布/趋势/CSV 导出）
- [x] 语音朗读评测
- [x] 作文/写作批改
- [x] 学习画像/能力雷达
- [x] 竞赛/闯关式任务系统
- [x] 教师 AI 工具（AI 组卷/讲稿/错题讲评）
- [x] 学情分析（热力图/学情报告/重点提醒）
- [ ] 付费套餐与订阅

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

> 若设置了 `DATABASE_URL` 则写入数据库，否则写入 `data/*.json`。

### Render 快速接入

1. 在 Render 创建 PostgreSQL 服务
2. 将连接串配置为环境变量 `DATABASE_URL`
3. 进入 Render Shell 或本地执行：

```
npm run db:init
npm run seed:base
npm run seed:stage3
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

默认使用 mock 讲解。若需要接入模型，设置以下环境变量：

```
LLM_PROVIDER=zhipu
LLM_API_KEY=你的智谱API Key
LLM_MODEL=glm-4.7
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_CHAT_PATH=/chat/completions
```

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

## 验收与发布文档

- Week7 回归验收清单：`docs/week7-challenge-regression-checklist.md`
- Week8 灰度发布手册：`docs/week8-gray-release-runbook.md`

## 下一步

- 接入真实题库与知识点树
- 连接 AI 模型与检索系统
- 上线家长周报生成与自动推送
