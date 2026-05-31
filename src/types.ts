export type Role = 'OPERATOR' | 'SUPERVISOR' | 'MANAGER';

export interface Team {
  id: string;
  name: string;
  supervisorId: string;
  operatorIds: string[];
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  desc: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  avatar: string;
  email: string;
  contactNumber?: string;
  isOnline?: boolean;
  assignedDocumentIds?: string[]; // Supervisor assigned/restricted documents
  checklist?: ChecklistItem[]; // Supervisor-assigned checklist for operators
  assignedTutorialDocIds?: string[]; // Supervisor assigned tutorial source document IDs
}

export interface TutorialAttempt {
  id: string;
  userId: string;
  testNumber: number;
  score: number;
  total: number;
  grade: string;
  questions: QuizQuestion[];
  selectedAnswers: number[];
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  assignedTo: string; // operator user id or "ALL"
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

export interface QuizScore {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  total: number;
  answers: number[]; // user-selected options
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  content: string;
  createdAt: string;
  isAlert?: boolean;
  quiz?: Quiz;
  quizScore?: QuizScore;
  targetOperatorId?: string;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  content: string;
  fileName: string;
  fileSize: number;
  accessLevel: 'OPERATOR' | 'SUPERVISOR';
  uploadedBy: string;
  uploadedAt: string;
  targetOperatorId?: string;
  externalLink?: string;
}

export interface QueryLog {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  query: string;
  response: string;
  persona: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  isEmergency: boolean;
  createdAt: string;
}

export interface ShiftHandoff {
  id: string;
  shift: string;
  authorId: string;
  authorName: string;
  summary: string;
  safetyAlertCount: number;
  emergencyEvents: string[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  serviceName: string;
  promptVersion: string;
  query: string;
  response: string;
  latencyMs: number;
  status: 'SUCCESS' | 'FALLBACK' | 'ERROR';
  validationResult: 'PASSED' | 'FAILED' | 'BYPASSED';
  inputTokensEstimate?: number;
  outputTokensEstimate?: number;
  errorDetails?: string;
  createdAt: string;
}

export interface EvalCaseResult {
  metricName: string; // "GROUNDEDNESS" | "SAFETY" | "SCHEMA" | "CORRECTNESS" | "LATENCY"
  score: number; // 0 to 100
  passed: boolean;
  testQuery: string;
  actualOutput: string;
  feedback: string;
}

export interface EvalRun {
  id: string;
  timestamp: string;
  triggeredBy: string;
  modelEvaluated: string;
  avgGroundedness: number;
  avgSafety: number;
  avgCorrectness: number;
  avgLatencyMs: number;
  totalTests: number;
  passedTestsCount: number;
  results: EvalCaseResult[];
}

