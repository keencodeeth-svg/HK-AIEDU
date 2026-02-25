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
  last_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, knowledge_point_id)
);

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
  UNIQUE (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS challenge_claims_user_idx ON challenge_claims (user_id);

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
