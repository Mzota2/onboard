export type UserRole = "admin" | "interviewer";

export type SilhouetteKind = "m1" | "f1" | "m2";

export type CandidateStatus = "phase1" | "phase2" | "finalized" | "archived";

export type PositionStatus = "active" | "closed";

export interface UserSettings {
  vettingAlerts: boolean;
  autoLock: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  initials: string;
  settings: UserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  scale: number; // e.g., 1-5
}

export interface Scenario {
  id: string;
  name: string; // e.g., "Technical", "Communication", "Problem Solving"
  description: string;
  criteria: Criterion[];
}

export type QuestionPhase = "phase1" | "phase2" | "both";

export interface RatingCriteria {
  criteria: { [criterionId: string]: number }; // Dynamic criteria based on scenario
  notes?: string;
}

export interface PositionQuestion {
  id: string;
  prompt: string;
  order: number;
  scenarioId: string; // Reference to scenario
  phase: QuestionPhase; // Which phase(s) this question belongs to
}

export interface Position {
  id: string;
  title: string;
  code: string;
  description: string;
  status: PositionStatus;
  createdBy: string;
  /** @deprecated Use questions with phase field */
  phase1Questions: PositionQuestion[];
  /** @deprecated Use questions with phase field */
  phase2Questions: PositionQuestion[];
  questions: PositionQuestion[]; // Unified question list with phase field
  scenarios: Scenario[]; // Available scenarios for this position
  phase1ConsentReleased: boolean;
  phase2ConsentReleased: boolean;
  autoPromotion: boolean;
  promotionTopN: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionScore {
  questionId: string;
  criteria: RatingCriteria;
}

export interface PhaseScores {
  scores: { [questionId: string]: QuestionScore };
  aggregateScore: number;
  isComplete: boolean;
  lastQuestionIndex: number;
}

export interface Evaluation {
  id: string;
  candidateId: string;
  positionId: string;
  interviewerId: string;
  interviewerName: string;
  phase: "phase1" | "phase2";
  questionScores: { [questionId: string]: QuestionScore };
  aggregateScore: number;
  isComplete: boolean;
  lastQuestionIndex: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  positionId: string;
  name: string;
  code: string;
  currentRole: string;
  silhouette: SilhouetteKind;
  status: CandidateStatus;
  phase1Complete: boolean;
  phase2Complete: boolean;
  phase1Scores: {
    technicalDepth: number;
    clarity: number;
    impact: number;
    notes?: string;
  } | null;
  phase2Scores: {
    technicalDepth: number;
    clarity: number;
    impact: number;
    notes?: string;
  } | null;
  promoted: boolean;
  promotedToPhase2: boolean;
  promotionMethod: "manual" | "automatic" | null;
  rank: number;
  aggregateScore: number;
  disqualified: boolean;
  disqualifiedAt?: string;
  disqualifiedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStats {
  phase1Count: number;
  phase2Count: number;
  phase1Pending: number;
  phase2Pending: number;
  phase1AvgScore: number;
  phase2AvgScore: number;
}

export type CreateUserInput = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
};

export type CreatePositionInput = {
  title: string;
  code: string;
  description: string;
  createdBy: string;
  questions?: PositionQuestion[];
  scenarios?: Scenario[];
};

export type UpdatePositionInput = Partial<
  Pick<Position, "title" | "code" | "description" | "status" | "questions" | "scenarios">
>;

export type UpdateCandidateInput = Partial<
  Pick<Candidate, "name" | "code" | "currentRole" | "silhouette" | "status" | "promotedToPhase2" | "promotionMethod" | "disqualified" | "disqualifiedAt" | "disqualifiedReason">
>;

export type CreateCandidateInput = {
  positionId: string;
  name: string;
  code: string;
  currentRole: string;
  silhouette?: SilhouetteKind;
};
