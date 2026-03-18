# Staging / Production 发布手册

更新时间：2026-03-18

适用目标：
- staging 预发验证
- production 正式发布
- 发布后 smoke 与失败回滚

## 1. 发布原则

- 先 staging，后 production。
- 任何发布都先执行本地质量门，再执行数据库迁移，再做健康检查与远端 smoke。
- `liveness` 只回答“服务是否存活”，`readiness` 回答“核心依赖是否可用”。
- `readiness` 不是公网裸露接口；生产环境必须使用管理员会话或 `READINESS_PROBE_TOKEN` 访问。

## 2. 发布前检查

本地代码检查：

```bash
npm run verify:strict
npm run test:smoke:production-like:local
```

如果本次变更直接影响浏览器关键流程、对象存储读写链路或 production-like 浏览器回归，再额外执行：

```bash
npm run test:browser:production-like:local
```

如果本次变更涉及学校排课 AI 预演 / 应用 / 回滚、模板、教师规则、禁排时段或相关运行时状态，再额外执行：

```bash
npm run test:school-schedules:production-like:local
```

如果当前机器没有可用 Docker daemon，但本机已有可复用 PostgreSQL，可改用：

```bash
PRODUCTION_LIKE_USE_EXISTING_DB=1 npm run test:smoke:production-like:local
```

环境检查：
- 已配置 `DATABASE_URL`
- 已配置对象存储根或外部对象存储
- 生产环境必须关闭 `ALLOW_JSON_FALLBACK`
- staging / production 环境已配置 `READINESS_PROBE_TOKEN`
- 已准备远端 smoke 使用的管理员账号
- 已准备远端 smoke 读取的学校 ID（默认 `school-default`，可通过 `API_TEST_SMOKE_SCHOOL_ID` 覆盖）
- 已准备本次发布的 commit / tag / rollback 目标版本

推荐记录：
- 发布人
- 目标环境
- 发布版本 / commit SHA
- 预期变更点
- 回滚版本 / commit SHA

## 3. Staging 发布步骤

1. 优先使用仓库内预构建发布脚本，避免在低内存主机上远端 `next build`：

```bash
DEPLOY_REMOTE_HOST=root@staging.example.com \
DEPLOY_EXTERNAL_HEALTH_URL=https://staging.example.com/api/health \
npm run deploy:remote:prebuilt
```

脚本默认行为：
- 本地先执行 `npm run build`
- 打包当前工作区，但排除 `node_modules` 与 `.next/cache`
- 上传 release 包到远端并恢复远端 `.env.production`
- 远端仅执行 `npm ci --omit=dev`、`db:migrate`、`3001` canary、`3000` 正式切流
- 若 `.env.production` 内存在 `READINESS_PROBE_TOKEN`，会额外校验 readiness

脚本前提：
- 工作区默认必须干净；如要显式部署未提交改动，需设置 `DEPLOY_ALLOW_DIRTY=1`
- 远端需要保留稳定的环境文件，默认路径 `/var/www/HK-AIEDU/.env.production`
- 远端已安装 `pm2`

常用覆盖项：

```bash
DEPLOY_REMOTE_HOST=root@staging.example.com \
DEPLOY_REMOTE_ENV_SOURCE=/srv/hk-ai-edu/.env.production \
DEPLOY_PM2_APP_NAME=hk-ai-edu-staging \
DEPLOY_CANARY_APP_NAME=hk-ai-edu-staging-canary \
DEPLOY_REMOTE_PRODUCTION_PORT=3100 \
DEPLOY_REMOTE_CANARY_PORT=3101 \
npm run deploy:remote:prebuilt
```

2. 确认迁移已执行；若这次不是通过脚本发布，再手工执行：

```bash
npm run db:migrate
```

3. 检查健康接口：

```bash
curl -fsS https://staging.example.com/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://staging.example.com/api/health/readiness
```

4. 执行远端 smoke：

```bash
API_TEST_BASE_URL=https://staging.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
npm run test:smoke:remote
```

5. 如需只做依赖健康验证，可执行：

```bash
API_TEST_BASE_URL=https://staging.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_SCOPE=health \
API_TEST_SERVER_MODE=remote \
API_TEST_FALLBACK_TO_DEV=0 \
node scripts/test-api-routes.mjs
```

6. 通过后记录结果，再进入 production。

## 4. Production 发布步骤

1. 确认 staging smoke 通过，且未发现阻塞项。
2. 使用同一条预构建脚本部署相同 commit 到 production：

```bash
DEPLOY_REMOTE_HOST=root@prod.example.com \
DEPLOY_EXTERNAL_HEALTH_URL=https://prod.example.com/api/health \
npm run deploy:remote:prebuilt
```

3. 确认迁移已执行；若这次不是通过脚本发布，再手工执行：

```bash
npm run db:migrate
```

4. 检查健康接口：

```bash
curl -fsS https://prod.example.com/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://prod.example.com/api/health/readiness
```

5. 执行远端 smoke：

```bash
API_TEST_BASE_URL=https://prod.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
npm run test:smoke:remote
```

6. 检查管理端关键面板：
- `/admin/logs`
- `/admin/experiments`
- `/admin/ai-models`

7. 记录结果并确认是否放量。

## 5. GitHub Actions 手工 smoke

工作流：`.github/workflows/release-smoke.yml`

前置条件：
- GitHub `staging` / `production` environment 中都已配置 `READINESS_PROBE_TOKEN` secret
- 如默认管理员账号或学校 ID 不适用，额外配置：
  - `API_TEST_ADMIN_PASSWORD` secret
  - `API_TEST_ADMIN_EMAIL` variable
  - `API_TEST_SMOKE_SCHOOL_ID` variable

使用方式：
1. 进入 Actions -> `Release Smoke`
2. 选择 `target`：`staging` 或 `production`
3. 填写 `base_url`
4. 选择 `scope`：默认 `smoke`
5. 运行后查看 job log 与 summary

适用场景：
- 发布后由值班同学执行一次标准 smoke
- 手工回滚后快速复验

## 6. Smoke 覆盖范围

当前远端 smoke 覆盖：
- `GET /api/health`
- `GET /api/health/readiness`
- `GET /api/auth/password-policy`
- 学生注册
- 学生登录
- `GET /api/auth/me`
- 学生登出
- 管理员登录
- `GET /api/school/schedules?schoolId=$API_TEST_SMOKE_SCHOOL_ID`
- 管理员登出

远端 smoke 前提：
- 目标环境存在可登录管理员账号；未显式传参时默认使用 `admin@demo.com` / `Admin123`
- 目标环境存在可读取学校数据；未显式传参时默认使用 `school-default`

限制：
- 远端模式默认只允许 `smoke` / `health`
- 若要对已部署环境运行全量 API 套件，必须显式设置 `API_TEST_ALLOW_REMOTE_FULL=true`

## 7. 回滚步骤

触发条件：
- 迁移失败
- `readiness` 返回非 200 / `ready=false`
- 远端 smoke 失败
- 管理端关键面板不可用

回滚动作：
1. 停止继续放量。
2. 回退到上一个稳定版本。
3. 若本次迁移包含不可兼容变更，按数据库回滚预案执行。
4. 回滚后重新检查：

```bash
curl -fsS https://target.example.com/api/health
curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" https://target.example.com/api/health/readiness
API_TEST_BASE_URL=https://target.example.com \
API_TEST_READINESS_TOKEN=$READINESS_PROBE_TOKEN \
API_TEST_ADMIN_EMAIL=admin@demo.com \
API_TEST_ADMIN_PASSWORD=Admin123 \
API_TEST_SMOKE_SCHOOL_ID=school-default \
npm run test:smoke:remote
```

5. 在发布记录中补齐：
- 故障开始时间
- 发现方式
- 回滚完成时间
- 影响范围
- 后续修复负责人

## 8. 发布记录模板

```text
环境：
版本：
发布人：
开始时间：
完成时间：
db:migrate：
health：
readiness：
remote smoke：
是否回滚：
备注：
```
