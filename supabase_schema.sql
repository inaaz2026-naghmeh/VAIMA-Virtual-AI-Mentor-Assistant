-- supabase_schema.sql - Supabase PostgreSQL Database Schema
-- Designed for Industrial AI Operating System enterprise-grade SaaS

-- Enable Vector extensions for semantic similarity search on indexed manuals (Advanced RAG Layer)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users Profile table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('OPERATOR', 'SUPERVISOR')),
  avatar TEXT,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexed Knowledge Base Documents (Manuals) metadata table
CREATE TABLE IF NOT EXISTS documents_metadata (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  access_level VARCHAR(50) NOT NULL CHECK (access_level IN ('OPERATOR', 'SUPERVISOR')),
  uploaded_by VARCHAR(255) NOT NULL,
  content TEXT NOT NULL, -- Core procedural checklist parsed
  embedding VECTOR(1024), -- Gemini Embedding 2 dimension parameters
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. AI Query Logs & Triggers Analytics history table
CREATE TABLE IF NOT EXISTS query_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  persona VARCHAR(50) NOT NULL CHECK (persona IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  is_emergency BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Micro-learning Safety Quizzes database table
CREATE TABLE IF NOT EXISTS quizzes (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  questions JSONB NOT NULL, -- Array of questions, options, correct indices, and explanation citation references
  assigned_to VARCHAR(255) DEFAULT 'ALL',
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Quiz Scores compliant submissions ledger table
CREATE TABLE IF NOT EXISTS quiz_scores (
  id VARCHAR(255) PRIMARY KEY,
  quiz_id VARCHAR(255) REFERENCES quizzes(id) ON DELETE CASCADE,
  quiz_title VARCHAR(255) NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  answers INT[] NOT NULL, -- Operator's answers matching questions indices
  submitted_by VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  submitted_by_name VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Live Chat Messages logs thread table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(255) PRIMARY KEY,
  sender_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  sender_name VARCHAR(255) NOT NULL,
  sender_role VARCHAR(50) NOT NULL CHECK (sender_role IN ('OPERATOR', 'SUPERVISOR')),
  content TEXT NOT NULL,
  is_alert BOOLEAN DEFAULT FALSE,
  quiz_id VARCHAR(255) REFERENCES quizzes(id) ON DELETE SET NULL,
  quiz_score_id VARCHAR(255) REFERENCES quiz_scores(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Shift Handoff executive summaries database table
CREATE TABLE IF NOT EXISTS shift_handoffs (
  id VARCHAR(255) PRIMARY KEY,
  shift VARCHAR(100) NOT NULL,
  author_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  author_name VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL, -- Automatic Gemini formulated handoff Markdown
  safety_alert_count INT DEFAULT 0,
  emergency_events TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Row-level security policies (RLS) layout guideline
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handoffs ENABLE ROW LEVEL SECURITY;

-- Operator security policy rules
CREATE POLICY "Operators read general documents" 
  ON documents_metadata FOR SELECT 
  USING (access_level = 'OPERATOR');

CREATE POLICY "Supervisors query absolute documents" 
  ON documents_metadata FOR SELECT 
  TO auth_users 
  USING (true);
