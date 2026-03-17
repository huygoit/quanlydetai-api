-- Tạo bảng students (chạy thủ công nếu migration:run bị kẹt ở migration trước)
-- Chạy trong psql hoặc client PostgreSQL: \i database/create_students_manual.sql

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  student_code VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,
  full_name VARCHAR(255) NULL,
  gender VARCHAR(20) NULL,
  date_of_birth DATE NULL,
  place_of_birth VARCHAR(255) NULL,
  class_code VARCHAR(50) NULL,
  class_name VARCHAR(255) NULL,
  course_name VARCHAR(255) NULL,
  status VARCHAR(100) NULL,
  major_code_raw VARCHAR(255) NULL,
  major_name VARCHAR(255) NULL,
  department_id BIGINT NULL REFERENCES departments(id) ON DELETE SET NULL,
  personal_email VARCHAR(255) NULL,
  school_email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  identity_card_number VARCHAR(50) NULL,
  identity_card_issue_place VARCHAR(255) NULL,
  identity_card_issue_date DATE NULL,
  ethnicity VARCHAR(100) NULL,
  permanent_address TEXT NULL,
  contact_address TEXT NULL,
  temporary_address TEXT NULL,
  note TEXT NULL,
  source_data JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_student_code_index ON students(student_code);
CREATE INDEX IF NOT EXISTS students_department_id_index ON students(department_id);
CREATE INDEX IF NOT EXISTS students_major_name_index ON students(major_name);

-- Đánh dấu migration đã chạy (tránh migration:run chạy lại)
INSERT INTO adonis_schema (name, batch)
SELECT 'database/migrations/1771833350617_create_students_table', COALESCE(MAX(batch), 0) + 1 FROM adonis_schema
ON CONFLICT (name) DO NOTHING;
