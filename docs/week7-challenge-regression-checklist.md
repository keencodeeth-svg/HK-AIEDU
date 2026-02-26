# Week7 回归与验收清单（挑战学习闭环 2.0）

## 1. 目标与范围
- 目标：确认“挑战任务与学习闭环绑定”在学生端、接口层和存储层都可用。
- 覆盖范围：
  - 学生端 `/challenge` 页面展示实验分组、解锁规则、学习证明。
  - 接口 `GET /api/challenges`、`POST /api/challenges/claim`。
  - 数据落库字段：`challenge_claims.linked_knowledge_points`、`learning_proof`、`unlock_rule`。

## 2. 回归前置
- Node.js 与依赖已安装：`npm install`
- 本地启动：`npm run dev`
- 具备学生账号（示例：`student@demo.com / Student123`）

## 3. 自动回归（必须全部通过）
```bash
npm run lint
npm run test:api
npm run build
```

通过标准：
- `lint` 无错误。
- `test:api` 输出 `API integration tests passed.`。
- `build` 成功，且包含 `/challenge`、`/api/challenges`、`/api/challenges/claim` 路由。

## 4. 手工验收步骤（学生端）
1. 登录学生账号，打开 `/challenge`。
2. 校验页面出现“实验分组 + 灰度比例”信息。
3. 任意检查 1 个任务卡片，确认有：
   - `linkedKnowledgePoints` 对应的知识点徽标
   - 解锁规则文案
   - 学习证明（近 7 天练习、正确率、错题复练、掌握度）
4. 选择一个未完成任务点击“领取奖励”，应提示“任务未完成”并带具体缺失动作。
5. 完成对应学习动作后再次领取，提示“奖励领取成功”。
6. 刷新页面确认：
   - 已领取任务保持 `已领取`
   - 积分增加且不重复领取

## 5. API 验收要点
- `GET /api/challenges` 返回：
  - `data.tasks[]`（含 `linkedKnowledgePoints`、`unlockRule`、`learningProof`）
  - `data.experiment`（含 `key`、`variant`、`enabled`、`rollout`）
- `POST /api/challenges/claim` 返回：
  - 未达成时：`result.ok = false` 且 `result.message` 含具体原因
  - 达成时：`result.ok = true`，并返回最新 `tasks`、`points`、`experiment`

## 6. 数据层验收（DB 模式）
执行查询：
```sql
SELECT task_id, points, linked_knowledge_points, learning_proof, unlock_rule
FROM challenge_claims
WHERE user_id = '<student_id>'
ORDER BY claimed_at DESC
LIMIT 5;
```

通过标准：
- 新增领取记录可查。
- `linked_knowledge_points` 非空数组（有学习关联）。
- `learning_proof` 为 JSON，包含 `missingActions`/`linkedAttempts` 等字段。
- `unlock_rule` 与任务规则一致。

## 7. 验收结论模板
- 自动回归：通过 / 不通过
- 手工验收：通过 / 不通过
- 数据层验收：通过 / 不通过
- 结论：可发布 / 阻塞（附阻塞项）
