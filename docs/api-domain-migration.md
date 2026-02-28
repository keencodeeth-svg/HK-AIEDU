# API 域分层与迁移清单

更新时间：2026-02-28

当前进度（代码统计）：
- `withApi` 路由：`0`
- `create*Route` 路由：`191`

## 1. 目标
- 将 `app/api` 路由从散落实现迁移到统一模板：
  - 统一鉴权/参数解析/响应头
  - 统一缓存策略（公共短缓存、私有短缓存、实时）
  - 统一域标签（`x-api-domain`）

## 2. 基础设施
- 统一缓存策略：`lib/api/cache.ts`
- 统一路由工厂：`lib/api/route-factory.ts`
- 域包装器：
  - `lib/api/domains/auth.ts`
  - `lib/api/domains/learning.ts`
  - `lib/api/domains/exam.ts`
  - `lib/api/domains/ai.ts`
  - `lib/api/domains/admin.ts`

## 3. 缓存预设
- `public-static`：稳定公共数据，长缓存
- `public-short`：公共数据，短缓存
- `private-short`：用户私有数据，短缓存
- `private-realtime`：实时数据，`no-store`

## 4. 已迁移（全量完成）

- `app/api` 全部路由已迁移到域路由工厂（`createAuthRoute` / `createLearningRoute` / `createExamRoute` / `createAiRoute` / `createAdminRoute`）
- 所有路由已统一挂载域响应头 `x-api-domain` 与缓存预设策略
- 本文以下清单保留为代表性与高频链路样例

### 公共基础
- `GET /api/health`
- `GET /api/knowledge-points`

### 学习域（student / teacher）
- `GET /api/plan`
- `POST /api/plan/refresh`
- `POST /api/practice/next`
- `POST /api/practice/submit`
- `POST /api/practice/explanation`
- `POST /api/practice/variants`
- `GET /api/student/radar`
- `GET /api/wrong-book/review-queue`
- `POST /api/wrong-book/review-result`
- `GET /api/challenges`
- `GET /api/teacher/alerts`
- `GET /api/teacher/insights`
- `GET /api/teacher/insights/heatmap`
- `POST /api/teacher/insights/report`
- `GET /api/teacher/insights/intervention-causality`

### AI 域
- `POST /api/ai/assist`
- `GET /api/ai/history`
- `POST /api/ai/history`

### Exam 域
- `GET /api/student/exams`
- `GET /api/teacher/exams`
- `POST /api/teacher/exams`

### Auth 域
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/teacher-register`
- `POST /api/auth/admin-register`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 教师作业链路（learning 域）
- `GET /api/teacher/assignments`
- `POST /api/teacher/assignments`
- `GET /api/teacher/assignments/[id]`
- `GET /api/teacher/assignments/[id]/stats`
- `POST /api/teacher/assignments/[id]/notify`
- `POST /api/teacher/assignments/[id]/ai-review`
- `GET /api/teacher/assignments/[id]/rubrics`
- `POST /api/teacher/assignments/[id]/rubrics`
- `GET /api/teacher/assignments/[id]/uploads`
- `GET /api/teacher/assignments/[id]/reviews/[studentId]`
- `POST /api/teacher/assignments/[id]/reviews/[studentId]`

### 家长协同链路（learning 域）
- `GET /api/parent/assignments`
- `GET /api/parent/favorites`
- `GET /api/parent/action-items/receipt`
- `POST /api/parent/action-items/receipt`

### 讨论区链路（learning 域）
- `GET /api/discussions`
- `POST /api/discussions`
- `GET /api/discussions/[id]`
- `POST /api/discussions/[id]/reply`

### 站内信协同链路（learning 域）
- `GET /api/inbox/threads`
- `POST /api/inbox/threads`
- `GET /api/inbox/threads/[id]`
- `POST /api/inbox/threads/[id]/messages`

### 课程与资源链路（learning 域）
- `GET /api/files`
- `POST /api/files`
- `GET /api/course/summary`
- `GET /api/course/syllabus`
- `POST /api/course/syllabus`
- `GET /api/library`
- `GET /api/library/[id]`
- `DELETE /api/library/[id]`
- `GET /api/library/[id]/annotations`
- `POST /api/library/[id]/annotations`
- `POST /api/library/[id]/knowledge-points`
- `POST /api/library/[id]/share`
- `POST /api/library/index`
- `GET /api/library/retrieve`
- `GET /api/library/shared/[token]`

### 学习运营链路（learning/admin 域）
- `POST /api/analytics/events`
- `GET /api/analytics/funnel`
- `GET /api/report/profile`
- `GET /api/report/weekly`
- `GET /api/notifications`
- `POST /api/notifications`
- `GET /api/announcements`
- `POST /api/announcements`

### 班级与日程链路（learning 域）
- `GET /api/classes`
- `GET /api/calendar`
- `GET /api/corrections`
- `POST /api/corrections`
- `PATCH /api/corrections/[id]`

### 教师通知与讲评包链路（learning 域）
- `GET /api/teacher/notifications/rules`
- `POST /api/teacher/notifications/rules`
- `POST /api/teacher/notifications/run`
- `POST /api/teacher/lesson/outline`
- `POST /api/teacher/lesson/wrong-review`
- `POST /api/teacher/lesson/review-pack`
- `POST /api/teacher/lesson/review-pack/dispatch`

### 学生学习补充链路（learning 域）
- `GET /api/favorites`
- `POST /api/favorites`
- `GET /api/favorites/[questionId]`
- `PATCH /api/favorites/[questionId]`
- `DELETE /api/favorites/[questionId]`
- `GET /api/teacher/favorites`
- `GET /api/wrong-book`
- `POST /api/diagnostic/start`
- `POST /api/diagnostic/submit`
- `GET /api/writing/history`
- `POST /api/writing/review`

### 学生成长与专注链路（learning 域）
- `GET /api/student/motivation`
- `GET /api/student/observer-code`
- `POST /api/student/observer-code`
- `GET /api/student/modules`
- `GET /api/student/modules/[id]`
- `GET /api/student/profile`
- `PUT /api/student/profile`
- `GET /api/student/growth`
- `GET /api/student/today-tasks`
- `POST /api/student/join-class`
- `GET /api/student/join-requests`
- `POST /api/focus/session`
- `GET /api/focus/summary`

### 教师执行链路（learning/exam 域）
- `GET /api/teacher/modules`
- `POST /api/teacher/modules`
- `PUT /api/teacher/modules/[id]`
- `GET /api/teacher/modules/[id]/resources`
- `POST /api/teacher/modules/[id]/resources`
- `DELETE /api/teacher/modules/[id]/resources`
- `POST /api/teacher/questions/check`
- `GET /api/teacher/gradebook`
- `GET /api/teacher/exams/[id]`
- `PATCH /api/teacher/exams/[id]`
- `GET /api/teacher/exams/[id]/export`
- `POST /api/teacher/exams/[id]/review-pack/publish`

### Admin 域
- `GET /api/admin/questions/quality`
- `GET /api/admin/ai/evals`
- `GET/POST /api/admin/ai/quality-calibration`

## 5. 后续治理（迁移后）
1. 逐步移除路由中重复的 `requireRole/getCurrentUser` 显式校验，统一依赖 `role` 配置收敛鉴权逻辑
2. 对高频读接口补齐更细粒度缓存策略复核（`private-short/public-short/private-realtime`）
3. 抽样做生产回归压测，验证域标签与缓存头对监控面板、CDN 与客户端行为无副作用

## 6. 验证门禁
- `npm run lint`
- `npm run test`
- `npm run build`
