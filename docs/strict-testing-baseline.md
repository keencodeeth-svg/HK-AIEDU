# Strict Testing Baseline

更新时间：2026-03-21

目标：把“开发时建议跑测试”升级为“开发与合并默认执行同一条严格质量门”。

## 1. 统一门禁

本地与 CI 的统一严格门为：

```bash
npm run verify:strict
```

执行顺序：

1. `npm run lint`
2. `npm run build`
3. `npm run test:unit`
4. `npm run test:api`
5. `npm run test:browser:built`

说明：

- `npm test` 仍保留为快速门，只覆盖 `unit + api`
- `verify:strict` 才是后续开发默认必须通过的完整门禁
- CI 已收口到 `strict-verify` job，避免“分散绿灯但整链未验证”的假通过

## 2. 当前覆盖面评估

当前已经自动化覆盖的层次：

- 静态与类型层：`lint + build`
- 纯逻辑层：`tests/unit/*`
- API 集成层：`scripts/test-api-routes.mjs`
- 浏览器关键链路：`tests/browser/smoke.spec.ts`
- production-like 部署基线：CI 中带 PostgreSQL + 对象存储根路径的 smoke + browser smoke + 学校排课深回归
- 本地 production-like 复现入口：`npm run test:smoke:production-like:local`
- 本地 production-like 浏览器复现入口：`npm run test:browser:production-like:local`
- 本地学校排课深回归入口：`npm run test:school-schedules:production-like:local`
- 部署后远端验证：`release-smoke.yml`

本地 production-like 入口额外保证：

- 自动复制临时 `DATA_SEED_DIR`，并剔除高频 JSON 运行态文件，避免 readiness 被仓库遗留 seed 文件污染
- 自动隔离临时 `DATA_DIR` / `OBJECT_STORAGE_ROOT`，避免 smoke 回写污染工作区
- 默认创建隔离临时数据库，避免本地重复执行时复用上一次 production-like 测试残留状态
- 可通过 `PRODUCTION_LIKE_USE_EXISTING_DB=1` 直接复用本机 PostgreSQL，绕过 Docker 首次拉镜像成本
- 如需固定数据库名，可显式设置 `PRODUCTION_LIKE_DB_NAME`；如需每次清空固定库，再配合 `PRODUCTION_LIKE_DB_RESET=1`

当前 API smoke 已覆盖：

- `GET /api/health`
- `GET /api/health/readiness`
- `GET /api/auth/password-policy`
- 学生注册
- 学生登录
- `GET /api/auth/me`
- 学生登出
- 管理员登录
- 只读拉取学校课表概览：`GET /api/school/schedules?schoolId=$API_TEST_SMOKE_SCHOOL_ID`
- 管理员登出

当前 API smoke 前提：

- 默认管理员账号为 `admin@demo.com` / `Admin123`，可通过 `API_TEST_ADMIN_EMAIL`、`API_TEST_ADMIN_PASSWORD` 覆盖
- 默认课表学校为 `school-default`，可通过 `API_TEST_SMOKE_SCHOOL_ID` 覆盖
- 远端环境需要预先存在可登录管理员与可读取学校数据；本地 production-like 入口会自动执行 `seed:base + seed:stage3`

当前学校排课 production-like API 回归已覆盖：

- 课表模板保存与查询
- 教师禁排时段保存与查询
- 锁定节次保护
- AI 预演、应用、最新操作查询、回滚
- 教室冲突检测
- 教师周课时上限、连堂上限、跨校区间隔规则

当前学校排课 production-like API 回归入口：

- 默认本地入口：`npm run test:school-schedules`
- DB-only / object-storage 本地入口：`npm run test:school-schedules:production-like:local`
- CI 入口：`.github/workflows/ci.yml` 中的 `production-like-regression` job 会顺序执行 `test:smoke:production-like`、`test:browser:production-like` 与 `test:school-schedules:production-like`
- 可通过 `API_TEST_SCHOOL_ID` 覆盖默认学校，未设置时回退到 `school-default`

当前浏览器 smoke 已覆盖：

- 学生登录并进入学习控制台
- 教师发布作业
- 家长提交行动回执
- 用户提交账号恢复请求
- 管理员异常登录后收到安全告警通知
- 用户连续登录失败后被临时锁定
- 学生完成老师发布考试并提交
- 学生上传作业附件并由教师在批改页读取 / 下载
- 教师上传课程资料并由学生在课程文件中心访问 / 下载
- 教师发布公告并由学生查看
- 教师发布公告并由家长查看
- 教师发起站内会话并由学生回复
- 教师抄送家长的站内会话并由家长回复
- 教师上传模块资源并由学生在模块详情页访问 / 下载
- 管理员在工单台接单并解决恢复请求
- 管理员完成资料库文件上传、下载与分享
- 学校管理员完成排课 AI 预演、写入与回滚
- 学校管理员组织边界隔离
- 管理员高风险操作 `step-up`
- 教师会话越权访问 admin API 被拦截

当前浏览器 smoke 还额外执行三条严格约束：

- Playwright 启动的内置服务统一带 `API_TEST_SCOPE=playwright`，与 API 集成测试使用同一类测试运行时契约，避免 API/浏览器对高频状态存储策略不一致
- 任一同源 `/api/*` 请求若返回 `4xx/5xx`，浏览器 smoke 将直接失败，不再允许“页面看起来通过但后台已经报错”
- CI 额外执行 `production-like-regression`，在 `DATABASE_URL + REQUIRE_DATABASE=true + ALLOW_JSON_FALLBACK=false + OBJECT_STORAGE_ROOT` 下先跑最小 smoke，再跑浏览器 smoke 与学校排课深回归

## 3. 仍然存在的严格测试缺口

这些缺口不影响当前严格门启用，但应作为后续新增测试的最高优先级：

- 其余对象存储读写链路仍缺浏览器级回归，当前已覆盖资料库、作业附件、课程资料与模块资源四条代表性路径
- 大页新抽出的页级 hook 主要靠 `build` 保证类型正确，缺少针对状态迁移的定向单测

## 4. 后续开发规则

- 任何影响工作台主流程、权限、提交流程、AI 结果回写的改动，提交前默认跑 `npm run verify:strict`
- 任何涉及登录、权限、管理员操作、家长回执、作业/考试提交的改动，优先补浏览器或 API 回归，不只补单测
- 任何涉及生产运行时状态迁移的改动，优先补 API 集成测试，不接受只靠手测
- 发布前除本地严格门外，仍需执行远端 smoke

## 5. 建议下一步

优先补这两项：

1. 其余对象存储读写链路的浏览器级回归
2. 大页新抽出 hook 的状态迁移定向单测
