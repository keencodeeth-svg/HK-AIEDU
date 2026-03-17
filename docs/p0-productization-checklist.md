# P0 Productization Checklist

更新时间：2026-03-17

目标：把当前项目从“功能完整的试点原型”推进到“可交付、可回滚、可复盘”的试点产品。

查阅入口：

- 想先看全局状态与文档索引：`docs/project-readiness-index.md`
- 想看运行时 JSON / DB 边界：`docs/runtime-state-inventory.md`
- 想看测试与发布基线：`docs/strict-testing-baseline.md`、`docs/staging-production-release-runbook.md`

## 1. 当前基线

- 工程基线已通过：`npm run verify:strict`、`npm run test:smoke:remote`
- 当前规模：`68` 个页面、`191` 个 API 路由、`78` 个单测文件
- 当前浏览器回归：`1` 个 smoke 文件、`14` 条关键流程 smoke
- 当前单测基线：`test:unit` 为 `201` 条用例
- 当前剩余文件态：当前工作树 `data/` 目录下还有 `23` 个 JSON 文件；`23` 个均已具备 DB canonical path，当前可见文件中已无 JSON-only 项
- 运行时仍存在 `data/*.json` 种子与 fallback 状态文件，但 P0 高频执行态已经收口为 DB-only，生产基线从“能跑”提升到“有明确硬失败边界”
- 关键前端工作台已成型：学生、家长、教师、学校、管理端均可单独进入

### 当前重点

- 学校排课栈已完成 DB canonical 收口，并补上了查询、创建、AI 预演 / 应用 / 回滚的路由级回归；远端 / production-like smoke、主干 CI production-like regression 与 browser smoke 都已经覆盖管理员课表关键闭环、公开账号恢复入口、登录锁定、管理员异常登录安全告警、学生考试提交、学生作业附件上传并由教师批改页读取 / 下载、恢复工单后台处理、资料库文件上传 / 下载 / 分享与学校组织边界；`ai-eval-gate` 与 `student-personas` 也已补齐 DB canonical path，最新 production-like 浏览器回归已清空 runtime fallback 告警，下一步转向其余对象存储链路、稳态巡检与 hook 定向单测
- 对当前工作树里 `23` 个已具备 DB canonical path 的文件，明确“生产态 DB canonical、JSON 仅作 seed / fallback”的使用边界
- 在现有 `14` 条浏览器 smoke 基线上继续补其余对象存储读写链路，并保持 CI 中的强制 PostgreSQL + 对象存储浏览器回归稳定可用
- 继续缩小超大工作台文件和 page-level 直发请求入口，避免回归成本反弹

## 2. P0 必须完成

### 数据与存储

- 生产强制启用 PostgreSQL 与对象存储
- 关闭生产 JSON fallback
- 当前已完成并进入 guardrails / DB-only 基线：
  - `sessions`
  - 登录限流、异常登录画像、恢复防滥用
  - 审计日志、通知、家长回执、专注记录
  - 作业进度与提交
  - 考试分发、草稿、提交
  - 练习尝试、学习计划、统一复练队列
  - 掌握度、订正任务、错题复练、记忆复习
  - 埋点
- 下一阶段迁移对象：
  - 低频内容态和组织态 JSON fallback 继续压缩
  - 文件元数据与教学内容管理侧剩余本地态
  - 学校排课链路的 DB canonical 回归覆盖与生产切换验证
- 验收：
  - 生产环境不再依赖本地运行时 JSON 写入
  - 多实例下登录、限流、审计结果一致

### 发布与回滚

- 固化 `staging / production` 双环境流程
- 每次发布固定执行：
  - 数据库迁移
  - readiness 检查
  - smoke 检查
  - 失败回滚
- 验收：
  - 从干净环境可按文档完成部署
  - 至少完成一次演练式回滚

### 测试与回归

- 保持现有 `verify:strict + remote smoke` 基线
- 保持 `test:smoke:production-like:local` 可持续通过
- 保持 `test:school-schedules:production-like:local` 可持续通过
- 保持主干 CI 中 `test:smoke:production-like` + `test:browser:production-like` + `test:school-schedules:production-like` 顺序回归稳定可用
- 保持远端 / production-like smoke 中管理员课表只读校验稳定可用
- 保持当前浏览器级关键流程回归：
  - 学生登录并进入学习控制台
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
  - 管理员 step-up 高风险操作
  - 关键越权访问拦截
- 下一轮优先扩展：
  - 其余对象存储读写链路
  - 页级 hook 状态迁移定向单测
- 验收：
  - 核心闭环具备浏览器级自动化 smoke
  - CI 失败阻断合并

### 安全与权限

- 补齐 same-origin / CSRF 覆盖面
- 管理员 2FA 或 step-up 收口
- 权限矩阵回归覆盖：
  - 跨角色
  - 跨班级
  - 跨学校
- 验收：
  - 高风险接口具备统一防护
  - 越权访问可稳定拦截并可审计

### 观测与排障

- 外部错误追踪正式接入
- API / AI 失败告警接入
- traceId 能贯穿：
  - API 响应
  - AI 调用
  - 外部错误上报
- 验收：
  - 关键 500 和 AI 失败可在 5 分钟内定位到责任链路

## 3. 产品与体验 P0

### 产品收敛

- 首批试点只讲一条主线：
  - 学生任务推进
  - 教师干预
  - 家长回执
- 学校端与平台端定位为支撑能力，不作为首批销售主叙事

### 首屏信息层级

- 学生端首页首屏只回答三件事：
  - 现在先做什么
  - 为什么现在先做
  - 卡住时去哪里
- 家长端首页首屏只回答三件事：
  - 今晚先做什么
  - 哪些任务必须跟进
  - 做完后再看哪些信息

### 试点演示材料

- 统一首页文案、试点演示脚本和价值主张
- 保证 3 分钟内能讲清产品最强闭环

## 4. 文件关注点

- 数据与 fallback：
  - `lib/storage.ts`
  - `lib/db.ts`
  - `lib/auth.ts`
- API 基线：
  - `lib/api/route-factory.ts`
- 错误追踪：
  - `lib/error-tracker.ts`
- 学生工作台：
  - `app/student/page.tsx`
- 家长工作台：
  - `app/parent/page.tsx`
- 发布脚本：
  - `package.json`
  - `scripts/`

## 5. 执行顺序

1. 先收口生产数据基线
2. 再继续拆大页面的状态、请求、展示层
3. 再补浏览器级关键链路回归和远端演练
4. 再做首页首屏减负与试点叙事统一
