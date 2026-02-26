# Week8 灰度发布手册（A/B 验证 + 回滚）

## 1. 发布目标
- 对实验 `challenge_learning_loop_v2` 做可控灰度放量。
- 通过 A/B 指标（留存、正确率、复练完成率）决定增量、保持或回滚。

## 2. 涉及能力
- 管理端页面：`/admin/experiments`
- 开关接口：
  - `GET /api/admin/experiments/flags`
  - `POST /api/admin/experiments/flags`
- 报告接口：
  - `GET /api/admin/experiments/ab-report?days=7`
- 学生挑战接口（可观察分组）：
  - `GET /api/challenges`

## 3. 发布前检查（Preflight）
1. 代码验证：
```bash
npm run lint
npm run test:api
npm run build
```
2. 数据结构就绪：
   - 已执行 `db/schema.sql`
   - 存在 `experiment_flags` 表
3. 管理员账号可用，可访问 `/admin/experiments`

## 4. 灰度执行步骤
1. 管理员登录后进入 `/admin/experiments`。
2. 找到 `challenge_learning_loop_v2`：
   - `enabled = on`
   - `rollout = 10`（首批建议 10%）
3. 使用两个以上学生账号验证分流：
   - 打开 `/challenge`
   - 观察“实验分组：实验组/对照组”是否按灰度比例出现差异。
4. 观察 `A/B 结果报告`：
   - 默认窗口 7 天，可用 `days=3~30` 调整。
5. 按阈值放量（建议每日最多调一次）：
   - 10% -> 30% -> 50% -> 70% -> 100%
   - 每次调高前至少观察一个统计窗口。

## 5. 放量/收敛判定阈值
系统内置建议规则（`lib/experiments.ts`）：
- `increase`：实验组相对对照组同时满足
  - 留存率提升 `>= +5%`
  - 正确率提升 `>= +3%`
  - 复练完成率提升 `>= +5%`
  - 动作：`rollout +20`
- `decrease`：出现任一
  - 留存率 `<= -5%`
  - 正确率 `<= -3%`
  - 复练完成率 `<= -5%`
  - 动作：`rollout -20`
- `keep`：其余情况维持当前比例继续观察。

## 6. 回滚方案（按严重级别）
### Level 1：指标轻微回落（分钟级）
- 保持开关开启，降低灰度比例（例如 50% -> 20%）。
- 在 `/admin/experiments` 直接调整，或调用 `POST /api/admin/experiments/flags`。

### Level 2：指标明显异常（分钟级）
- 立即停止实验流量：
  - `enabled = off`
  - `rollout = 0`
- 学生将全部回到 `control` 逻辑。

### Level 3：代码级故障（版本级）
- 若接口/页面异常且开关回退不足以止损，执行版本回退：
```bash
git revert 0119a41
git push origin main
```
- 回退后重新执行 `lint + test:api + build` 再发布。

## 7. 发布后验收（Go/No-Go）
1. 管理端：
   - 开关变更可保存。
   - 报告接口返回 `variants`、`delta`、`recommendation`。
2. 学生端：
   - `/challenge` 正常展示。
   - 不同账号可见不同分组（取决于 bucket 与 rollout）。
3. 数据与审计：
   - `experiment_flags` 有最新 `updated_at`。
   - 管理日志存在 `update_experiment_flag` 记录。

通过以上检查后可进入下一阶段放量。
