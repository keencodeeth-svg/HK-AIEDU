# Staging / Production 发布手册

更新时间：2026-03-12

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
npm run lint
npm run build
npm test
```

环境检查：
- 已配置 `DATABASE_URL`
- 已配置对象存储根或外部对象存储
- 生产环境必须关闭 `ALLOW_JSON_FALLBACK`
- staging / production 环境已配置 `READINESS_PROBE_TOKEN`
- 已准备本次发布的 commit / tag / rollback 目标版本

推荐记录：
- 发布人
- 目标环境
- 发布版本 / commit SHA
- 预期变更点
- 回滚版本 / commit SHA

## 3. Staging 发布步骤

1. 部署新版本到 staging。
2. 执行迁移：

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
2. 部署相同 commit 到 production。
3. 执行迁移：

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
