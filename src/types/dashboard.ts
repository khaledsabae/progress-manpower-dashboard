// Base types for API responses
export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  timestamp: string;
}

// Progress data types
export interface ProgressPhase {
  name: string;
  progress: number;
  status: 'completed' | 'in-progress' | 'not-started' | 'delayed';
}

export interface ProgressData {
  completionPercentage: number;
  completedTasks: number;
  totalTasks: number;
  lastUpdated: string;
  phases: ProgressPhase[];
}

// Manpower data types
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'on-leave' | 'inactive';
  allocation: number; // 0-100%
  skills: string[];
}

export interface ManpowerData {
  totalTeamMembers: number;
  available: number;
  onLeave: number;
  allocationRate: number;
  teamMembers: TeamMember[];
}

// Risk data types
export interface RiskItem {
  id: string;
  title: string;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  riskScore: number; // probability * impact
  status: 'open' | 'mitigated' | 'accepted' | 'transferred';
  mitigationPlan?: string;
  owner?: string;
  dueDate?: string;
  lastUpdated: string;
}

export interface RiskData {
  items: RiskItem[];
  totalRisks: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  lastUpdated: string;
}

// AI Insights
export interface AIInsights {
  predictedCompletionDate?: string;
  summaryReport?: string;
  recommendations?: string[];
  riskAnalysis?: string;
  [key: string]: unknown;
}

// Union type for all dashboard data
export type DashboardData = 
  | { type: 'progress'; data: ProgressData }
  | { type: 'manpower'; data: ManpowerData }
  | { type: 'aiInsights'; data: AIInsights }
  | { type: 'risk'; data: RiskData };

// Error handling types
export interface DataFetchError {
  message: string;
  status?: number;
  code?: string;
  timestamp: string;
  retryable: boolean;
}

// Data fetching state
export type DataState<T> = 
  | { status: 'idle' }
  | { status: 'loading'; timestamp: string }
  | { status: 'success'; data: T; timestamp: string }
  | { status: 'error'; error: DataFetchError; timestamp: string };
