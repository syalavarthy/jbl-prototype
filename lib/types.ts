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
  confidence?: number;
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

export type GradeBand =
  | 'not_started'
  | 'developing'
  | 'progressing'
  | 'proficient'
  | 'mastered'
  | 'struggling';

export interface NodeDisplayData {
  masteryState: MasteryState;
  gradeBand: GradeBand;
  fillPct: number;
  pMastery: number;
  labelOpacity: number;
  learningVelocity: number;
  borderThicknessPx: number;
}

export interface EdgeDisplayData {
  confidence: number;
  isDashed: boolean;
  confidenceLabel: string;
}

export interface SuggestionNodeDisplay {
  isSuggestion: true;
  suggestionId: string;
  label: string;
  position: { x: number; y: number };
}

export interface SuggestionEdgeDisplay {
  isSuggestion: true;
  suggestionId: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface BridgeSuggestion {
  id: string;
  type: 'bridge_node';
  label: string;
  targetNodeId: string;
  sourceNodeId: string;
  reason: string;
}

export interface MissingEdgeSuggestion {
  id: string;
  type: 'missing_edge';
  sourceNodeId: string;
  targetNodeId: string;
  reason: string;
}

export type Suggestion = BridgeSuggestion | MissingEdgeSuggestion;

export interface SeedSuggestions {
  bridgeSuggestions: BridgeSuggestion[];
  edgeSuggestions: MissingEdgeSuggestion[];
}

export interface GraphDisplayModel {
  nodeDisplays: Record<string, NodeDisplayData>;
  edgeDisplays: Record<string, EdgeDisplayData>;
  suggestionNodeDisplays: SuggestionNodeDisplay[];
  suggestionEdgeDisplays: SuggestionEdgeDisplay[];
  suggestions: Suggestion[];
}
