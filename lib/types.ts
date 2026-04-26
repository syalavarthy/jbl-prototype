export interface GraphNode {
  id: string;
  label: string;
  topic: string;
  description?: string;
  position?: {
    x: number;
    y: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AppSession {
  graph: GraphState;
  messages: ChatMessage[];
  documentText: string;
  initialized: boolean;
}

export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; result: string; isError: boolean }
  | { type: "graph_update"; graph: GraphState }
  | { type: "done" };

export type MasteryState = 'locked' | 'available' | 'in_progress' | 'mastered' | 'struggling';

export type MasteryMode = 'score' | 'bkt';

export interface BKTParams {
  pL0: number;
  pT: number;
  pG: number;
  pS: number;
}

export interface AssessmentResponse {
  timestamp: string;
  correct: boolean;
}

export interface NodeProgress {
  nodeId: string;
  score?: number;
  assessedAt?: string;
  attempts: number;
  params?: BKTParams;
  responses?: AssessmentResponse[];
  pMastery?: number;
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  nodeProgress: Record<string, NodeProgress>;
}
