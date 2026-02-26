CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT NOT NULL,
  grade TEXT,
  student_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  subjects TEXT[] NOT NULL,
  target TEXT,
  school TEXT,
  observer_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS observer_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_observer_code_idx ON student_profiles (observer_code);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  title TEXT NOT NULL,
  chapter TEXT NOT NULL,
  unit TEXT DEFAULT '未分单元'
);

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS unit TEXT;

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id),
  stem TEXT NOT NULL,
  options TEXT[] NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  question_type TEXT DEFAULT 'choice',
  tags TEXT[] NOT NULL DEFAULT '{}',
  abilities TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE questions ADD COLUMN IF NOT EXISTS abilities TEXT[];

CREATE TABLE IF NOT EXISTS question_quality_metrics (
  id TEXT PRIMARY KEY,
  question_id TEXT UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  quality_score INT NOT NULL DEFAULT 0,
  duplicate_risk TEXT NOT NULL DEFAULT 'low',
  ambiguity_risk TEXT NOT NULL DEFAULT 'low',
  answer_consistency INT NOT NULL DEFAULT 0,
  duplicate_cluster_id TEXT,
  answer_conflict BOOLEAN NOT NULL DEFAULT false,
  risk_level TEXT NOT NULL DEFAULT 'low',
  isolated BOOLEAN NOT NULL DEFAULT false,
  isolation_reason TEXT[] NOT NULL DEFAULT '{}',
  issues TEXT[] NOT NULL DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS quality_score INT NOT NULL DEFAULT 0;
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS duplicate_risk TEXT NOT NULL DEFAULT 'low';
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS ambiguity_risk TEXT NOT NULL DEFAULT 'low';
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS answer_consistency INT NOT NULL DEFAULT 0;
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS duplicate_cluster_id TEXT;
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS answer_conflict BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'low';
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS isolated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS isolation_reason TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS issues TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE question_quality_metrics ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS question_quality_metrics_question_idx ON question_quality_metrics (question_id);
CREATE INDEX IF NOT EXISTS question_quality_metrics_score_idx ON question_quality_metrics (quality_score);
CREATE INDEX IF NOT EXISTS question_quality_metrics_isolated_idx ON question_quality_metrics (isolated);

CREATE TABLE IF NOT EXISTS question_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  answer TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery_records (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  correct_count INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  mastery_score INT NOT NULL DEFAULT 0,
  confidence_score INT NOT NULL DEFAULT 0,
  recency_weight INT NOT NULL DEFAULT 0,
  mastery_trend_7d INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, knowledge_point_id)
);

ALTER TABLE mastery_records ADD COLUMN IF NOT EXISTS confidence_score INT NOT NULL DEFAULT 0;
ALTER TABLE mastery_records ADD COLUMN IF NOT EXISTS recency_weight INT NOT NULL DEFAULT 0;
ALTER TABLE mastery_records ADD COLUMN IF NOT EXISTS mastery_trend_7d INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS mastery_records_user_idx ON mastery_records (user_id);
CREATE INDEX IF NOT EXISTS mastery_records_subject_idx ON mastery_records (subject);

CREATE TABLE IF NOT EXISTS study_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS study_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES study_plans(id) ON DELETE CASCADE,
  knowledge_point_id TEXT NOT NULL,
  target_count INT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_history (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  favorite BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS correction_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS correction_tasks_user_idx ON correction_tasks (user_id);
CREATE INDEX IF NOT EXISTS correction_tasks_due_idx ON correction_tasks (due_date);

CREATE TABLE IF NOT EXISTS wrong_review_items (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  interval_level INT NOT NULL DEFAULT 1,
  next_review_at TIMESTAMPTZ,
  last_review_result TEXT,
  last_review_at TIMESTAMPTZ,
  review_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  first_wrong_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS wrong_review_items_user_idx ON wrong_review_items (user_id);
CREATE INDEX IF NOT EXISTS wrong_review_items_next_idx ON wrong_review_items (next_review_at);

CREATE TABLE IF NOT EXISTS teacher_alert_acks (
  id TEXT PRIMARY KEY,
  teacher_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (teacher_id, alert_id)
);

CREATE INDEX IF NOT EXISTS teacher_alert_acks_teacher_idx ON teacher_alert_acks (teacher_id);

CREATE TABLE IF NOT EXISTS teacher_alert_actions (
  id TEXT PRIMARY KEY,
  teacher_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (teacher_id, alert_id)
);

CREATE INDEX IF NOT EXISTS teacher_alert_actions_teacher_idx ON teacher_alert_actions (teacher_id);

CREATE TABLE IF NOT EXISTS teacher_alert_impacts (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  teacher_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  class_id TEXT,
  student_ids TEXT[] NOT NULL DEFAULT '{}',
  baseline JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (action_id)
);

CREATE INDEX IF NOT EXISTS teacher_alert_impacts_teacher_idx ON teacher_alert_impacts (teacher_id);
CREATE INDEX IF NOT EXISTS teacher_alert_impacts_alert_idx ON teacher_alert_impacts (alert_id);

CREATE TABLE IF NOT EXISTS parent_action_receipts (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  action_item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'done',
  note TEXT,
  estimated_minutes INT NOT NULL DEFAULT 0,
  effect_score INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (parent_id, student_id, source, action_item_id)
);

CREATE INDEX IF NOT EXISTS parent_action_receipts_parent_idx ON parent_action_receipts (parent_id, student_id);
CREATE INDEX IF NOT EXISTS parent_action_receipts_source_idx ON parent_action_receipts (source, action_item_id);

CREATE TABLE IF NOT EXISTS memory_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  stage INT NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS memory_reviews_user_idx ON memory_reviews (user_id);
CREATE INDEX IF NOT EXISTS memory_reviews_due_idx ON memory_reviews (next_review_at);

CREATE TABLE IF NOT EXISTS writing_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  feedback JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS writing_submissions_user_idx ON writing_submissions (user_id);

CREATE TABLE IF NOT EXISTS challenge_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  points INT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL,
  linked_knowledge_points TEXT[] NOT NULL DEFAULT '{}',
  learning_proof JSONB,
  unlock_rule TEXT,
  UNIQUE (user_id, task_id)
);

ALTER TABLE challenge_claims ADD COLUMN IF NOT EXISTS linked_knowledge_points TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE challenge_claims ADD COLUMN IF NOT EXISTS learning_proof JSONB;
ALTER TABLE challenge_claims ADD COLUMN IF NOT EXISTS unlock_rule TEXT;

CREATE INDEX IF NOT EXISTS challenge_claims_user_idx ON challenge_claims (user_id);

CREATE TABLE IF NOT EXISTS experiment_flags (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE experiment_flags ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE experiment_flags ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE experiment_flags ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE experiment_flags ADD COLUMN IF NOT EXISTS rollout INT NOT NULL DEFAULT 0;
ALTER TABLE experiment_flags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS experiment_flags_key_idx ON experiment_flags (key);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS focus_sessions_user_idx ON focus_sessions (user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_created_idx ON focus_sessions (created_at);

CREATE TABLE IF NOT EXISTS question_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS question_favorites_user_idx ON question_favorites (user_id);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  join_code TEXT,
  join_mode TEXT DEFAULT 'approval'
);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS join_code TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS join_mode TEXT;

CREATE TABLE IF NOT EXISTS class_students (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS class_join_requests (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  module_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  submission_type TEXT NOT NULL DEFAULT 'quiz',
  max_uploads INT NOT NULL DEFAULT 3,
  grading_focus TEXT
);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS module_id TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_type TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_uploads INT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS grading_focus TEXT;

CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES course_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS module_resources (
  id TEXT PRIMARY KEY,
  module_id TEXT REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size INT,
  content_base64 TEXT,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS course_syllabi (
  id TEXT PRIMARY KEY,
  class_id TEXT UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  summary TEXT,
  objectives TEXT,
  grading_policy TEXT,
  schedule_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS discussions (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS discussion_replies (
  id TEXT PRIMARY KEY,
  discussion_id TEXT REFERENCES discussions(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES discussion_replies(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS course_files (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  folder TEXT,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size INT,
  content_base64 TEXT,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inbox_threads (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_participants (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES inbox_threads(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  UNIQUE (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES inbox_threads(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_items (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assignment_progress (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  score INT,
  total INT
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  UNIQUE (assignment_id, student_id)
);

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_text TEXT;
ALTER TABLE IF EXISTS assignment_rubrics ADD COLUMN IF NOT EXISTS levels JSONB;

CREATE TABLE IF NOT EXISTS exam_papers (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  publish_mode TEXT NOT NULL DEFAULT 'teacher_assigned',
  anti_cheat_level TEXT NOT NULL DEFAULT 'basic',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  status TEXT NOT NULL DEFAULT 'published',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS publish_mode TEXT;
ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS anti_cheat_level TEXT;
UPDATE exam_papers SET publish_mode = 'teacher_assigned' WHERE publish_mode IS NULL;
UPDATE exam_papers SET anti_cheat_level = 'basic' WHERE anti_cheat_level IS NULL;

CREATE TABLE IF NOT EXISTS exam_paper_items (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES exam_papers(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 1,
  order_index INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_assignments (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  auto_saved_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  score INT,
  total INT,
  UNIQUE (paper_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam_answers (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (paper_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam_submissions (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  UNIQUE (paper_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam_review_packages (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (paper_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam_events (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  blur_count INT NOT NULL DEFAULT 0,
  visibility_hidden_count INT NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (paper_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignment_uploads (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INT NOT NULL,
  content_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS assignment_uploads_assignment_idx ON assignment_uploads (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_uploads_student_idx ON assignment_uploads (student_id);

CREATE TABLE IF NOT EXISTS assignment_ai_reviews (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignment_reviews (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  overall_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignment_review_items (
  id TEXT PRIMARY KEY,
  review_id TEXT REFERENCES assignment_reviews(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  wrong_tag TEXT,
  comment TEXT
);

CREATE TABLE IF NOT EXISTS assignment_rubrics (
  id TEXT PRIMARY KEY,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  levels JSONB,
  max_score INT NOT NULL DEFAULT 5,
  weight INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_review_rubrics (
  id TEXT PRIMARY KEY,
  review_id TEXT REFERENCES assignment_reviews(id) ON DELETE CASCADE,
  rubric_id TEXT REFERENCES assignment_rubrics(id) ON DELETE CASCADE,
  score INT NOT NULL,
  comment TEXT
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY,
  class_id TEXT UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  due_days INT NOT NULL DEFAULT 2,
  overdue_days INT NOT NULL DEFAULT 0,
  include_parents BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT,
  subject TEXT,
  grade TEXT,
  page TEXT,
  session_id TEXT,
  trace_id TEXT,
  entity_id TEXT,
  props JSONB,
  props_truncated BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS analytics_events_time_idx ON analytics_events (event_time);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id);

CREATE TABLE IF NOT EXISTS api_route_logs (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INT NOT NULL,
  duration_ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS api_route_logs_created_idx ON api_route_logs (created_at);
CREATE INDEX IF NOT EXISTS api_route_logs_method_path_idx ON api_route_logs (method, path);

CREATE INDEX IF NOT EXISTS classes_teacher_idx ON classes (teacher_id);
CREATE INDEX IF NOT EXISTS class_students_class_idx ON class_students (class_id);
CREATE INDEX IF NOT EXISTS class_students_student_idx ON class_students (student_id);
CREATE INDEX IF NOT EXISTS class_join_requests_class_idx ON class_join_requests (class_id);
CREATE INDEX IF NOT EXISTS class_join_requests_student_idx ON class_join_requests (student_id);
CREATE INDEX IF NOT EXISTS assignments_class_idx ON assignments (class_id);
CREATE INDEX IF NOT EXISTS assignments_module_idx ON assignments (module_id);
CREATE INDEX IF NOT EXISTS assignment_items_assignment_idx ON assignment_items (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_progress_assignment_idx ON assignment_progress (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_progress_student_idx ON assignment_progress (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS assignment_progress_unique_idx ON assignment_progress (assignment_id, student_id);
CREATE INDEX IF NOT EXISTS assignment_submissions_assignment_idx ON assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_submissions_student_idx ON assignment_submissions (student_id);
CREATE INDEX IF NOT EXISTS exam_papers_class_idx ON exam_papers (class_id);
CREATE INDEX IF NOT EXISTS exam_papers_created_idx ON exam_papers (created_at);
CREATE INDEX IF NOT EXISTS exam_paper_items_paper_idx ON exam_paper_items (paper_id);
CREATE INDEX IF NOT EXISTS exam_assignments_paper_idx ON exam_assignments (paper_id);
CREATE INDEX IF NOT EXISTS exam_assignments_student_idx ON exam_assignments (student_id);
CREATE INDEX IF NOT EXISTS exam_submissions_paper_idx ON exam_submissions (paper_id);
CREATE INDEX IF NOT EXISTS exam_submissions_student_idx ON exam_submissions (student_id);
CREATE INDEX IF NOT EXISTS exam_events_paper_idx ON exam_events (paper_id);
CREATE INDEX IF NOT EXISTS exam_events_student_idx ON exam_events (student_id);
CREATE INDEX IF NOT EXISTS assignment_reviews_assignment_idx ON assignment_reviews (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_reviews_student_idx ON assignment_reviews (student_id);
CREATE INDEX IF NOT EXISTS assignment_review_items_review_idx ON assignment_review_items (review_id);
CREATE INDEX IF NOT EXISTS assignment_rubrics_assignment_idx ON assignment_rubrics (assignment_id);
CREATE INDEX IF NOT EXISTS assignment_review_rubrics_review_idx ON assignment_review_rubrics (review_id);
CREATE INDEX IF NOT EXISTS assignment_review_rubrics_rubric_idx ON assignment_review_rubrics (rubric_id);
CREATE UNIQUE INDEX IF NOT EXISTS notification_rules_class_idx ON notification_rules (class_id);
CREATE INDEX IF NOT EXISTS announcements_class_idx ON announcements (class_id);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at);
CREATE INDEX IF NOT EXISTS course_modules_class_idx ON course_modules (class_id);
CREATE INDEX IF NOT EXISTS course_modules_parent_idx ON course_modules (parent_id);
CREATE INDEX IF NOT EXISTS module_resources_module_idx ON module_resources (module_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_syllabi_class_idx ON course_syllabi (class_id);
CREATE INDEX IF NOT EXISTS discussions_class_idx ON discussions (class_id);
CREATE INDEX IF NOT EXISTS discussions_created_idx ON discussions (created_at);
CREATE INDEX IF NOT EXISTS discussion_replies_discussion_idx ON discussion_replies (discussion_id);
CREATE INDEX IF NOT EXISTS course_files_class_idx ON course_files (class_id);
CREATE INDEX IF NOT EXISTS course_files_created_idx ON course_files (created_at);
CREATE INDEX IF NOT EXISTS inbox_participants_user_idx ON inbox_participants (user_id);
CREATE INDEX IF NOT EXISTS inbox_participants_thread_idx ON inbox_participants (thread_id);
CREATE INDEX IF NOT EXISTS inbox_messages_thread_idx ON inbox_messages (thread_id);

CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_logs_admin_idx ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS admin_logs_created_idx ON admin_logs (created_at);
