"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChatMessage, GraphState, MasteryMode, BKTParams, AssessmentResponse,
  NodeProgress, StudentProgress, SeedSuggestions, Suggestion, GraphDisplayModel,
} from "@/lib/types";
import GraphCanvas from "@/components/GraphCanvas";
import ChatPanel from "@/components/ChatPanel";
import UploadPanel from "@/components/UploadPanel";
import { computeGraphDisplay, computeBKT, executeTool, removeSuggestion } from "@/lib/graphUtils";

const STORAGE_KEYS = {
  graph: "kg_graph",
  messages: "kg_messages",
  documentText: "kg_doc_text",
  initialized: "kg_initialized",
  students: "kg_students",
  suggestions: "kg_suggestions",
} as const;

const DEFAULT_STUDENT: StudentProgress = {
  studentId: "demo",
  studentName: "Demo Student",
  nodeProgress: {},
};

const DEFAULT_SEEDS: SeedSuggestions = { bridgeSuggestions: [], edgeSuggestions: [] };

export default function Home() {
  const [graph, setGraph] = useState<GraphState>({ nodes: [], edges: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documentText, setDocumentText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "progress">("edit");
  const [masteryMode, setMasteryMode] = useState<MasteryMode>("score");
  const [studentProgress, setStudentProgress] = useState<StudentProgress>(DEFAULT_STUDENT);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [seedSuggestions, setSeedSuggestions] = useState<SeedSuggestions>(DEFAULT_SEEDS);

  const displayModel: GraphDisplayModel = useMemo(
    () => computeGraphDisplay(graph, studentProgress, masteryMode, showSuggestions, seedSuggestions),
    [graph, studentProgress, masteryMode, showSuggestions, seedSuggestions]
  );

  // Restore session from localStorage on mount
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEYS.initialized) !== "true") return;
    const g = localStorage.getItem(STORAGE_KEYS.graph);
    const m = localStorage.getItem(STORAGE_KEYS.messages);
    const d = localStorage.getItem(STORAGE_KEYS.documentText);
    const s = localStorage.getItem(STORAGE_KEYS.students);
    const sg = localStorage.getItem(STORAGE_KEYS.suggestions);
    if (g) setGraph(JSON.parse(g) as GraphState);
    if (m) setMessages(JSON.parse(m) as ChatMessage[]);
    if (d) setDocumentText(d);
    if (s) setStudentProgress(JSON.parse(s) as StudentProgress);
    if (sg) setSeedSuggestions(JSON.parse(sg) as SeedSuggestions);
    setInitialized(true);
  }, []);

  // Persist state changes to localStorage
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.graph, JSON.stringify(graph));
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
    localStorage.setItem(STORAGE_KEYS.documentText, documentText);
    localStorage.setItem(STORAGE_KEYS.initialized, "true");
    localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(studentProgress));
    localStorage.setItem(STORAGE_KEYS.suggestions, JSON.stringify(seedSuggestions));
  }, [graph, messages, documentText, initialized, studentProgress, seedSuggestions]);

  const handleNodeMove = (id: string, x: number, y: number) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)),
    }));
  };

  const handleScoreSubmit = useCallback(
    (nodeId: string, score: number) => {
      const existing = studentProgress.nodeProgress[nodeId];
      const node = graph.nodes.find((n) => n.id === nodeId);
      const dagDepth = node?.position ? Math.round((node.position.y - 80) / 140) : 0;
      const params: BKTParams = existing?.params ?? {
        pL0: Math.min(0.1 + 0.05 * dagDepth, 0.5),
        pT: 0.1, pG: 0.2, pS: 0.1,
      };
      const newResponse: AssessmentResponse = {
        timestamp: new Date().toISOString(),
        correct: score >= 70,
      };
      const responses = [...(existing?.responses ?? []), newResponse];
      const pMastery = computeBKT(responses, params);
      const newProgress: NodeProgress = {
        nodeId, score,
        assessedAt: new Date().toISOString(),
        attempts: (existing?.attempts ?? 0) + 1,
        params, responses, pMastery,
      };

      setStudentProgress((prev) => ({
        ...prev,
        nodeProgress: { ...prev.nodeProgress, [nodeId]: newProgress },
      }));

      // Upgrade edge confidence for outgoing edges when pMastery crosses into progressing
      if (pMastery >= 0.45) {
        setGraph((prev) => ({
          ...prev,
          edges: prev.edges.map((e) => {
            if (e.source !== nodeId) return e;
            if (!studentProgress.nodeProgress[e.target]) return e;
            const old = e.confidence ?? 0.5;
            return { ...e, confidence: old + (1 - old) * 0.15 };
          }),
        }));
      }
    },
    [graph.nodes, studentProgress]
  );

  const handleGraphGenerated = useCallback(
    (newGraph: GraphState, text: string, suggestions: SeedSuggestions, nodeVelocitySeeds: Record<string, number>) => {
      setGraph(newGraph);
      setDocumentText(text);
      setSeedSuggestions(suggestions);
      setStudentProgress((prev) => {
        const seeded = { ...prev.nodeProgress };
        Object.entries(nodeVelocitySeeds).forEach(([nodeId, attempts]) => {
          if (!seeded[nodeId]) seeded[nodeId] = { nodeId, attempts };
        });
        return { ...prev, nodeProgress: seeded };
      });
      setInitialized(true);
    },
    []
  );

  const handleSuggestionApprove = useCallback(
    (suggestion: Suggestion) => {
      if (suggestion.type === "bridge_node") {
        const addNodeResult = executeTool("add_node", {
          id: suggestion.id,
          label: suggestion.label,
          topic: graph.nodes.find((n) => n.id === suggestion.targetNodeId)?.topic ?? "General",
          description: suggestion.reason,
        }, graph);
        if ("error" in addNodeResult) return;
        const g1 = addNodeResult.graph;
        const addSrcEdge = executeTool("add_edge", { source_id: suggestion.sourceNodeId, target_id: suggestion.id }, g1);
        const g2 = "error" in addSrcEdge ? g1 : addSrcEdge.graph;
        const addTgtEdge = executeTool("add_edge", { source_id: suggestion.id, target_id: suggestion.targetNodeId }, g2);
        setGraph("error" in addTgtEdge ? g2 : addTgtEdge.graph);
      } else {
        const result = executeTool("add_edge", { source_id: suggestion.sourceNodeId, target_id: suggestion.targetNodeId }, graph);
        if (!("error" in result)) setGraph(result.graph);
      }
      setSeedSuggestions((prev) => removeSuggestion(prev, suggestion.id));
    },
    [graph]
  );

  const handleSuggestionDismiss = useCallback((id: string) => {
    setSeedSuggestions((prev) => removeSuggestion(prev, id));
  }, []);

  const handleViewModeToggle = useCallback(() => {
    setViewMode((m) => (m === "edit" ? "progress" : "edit"));
  }, []);

  const handleResetProgress = useCallback(() => {
    setStudentProgress(DEFAULT_STUDENT);
    setMasteryMode("score");
    if (initialized) localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(DEFAULT_STUDENT));
  }, [initialized]);

  const handleReset = () => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setGraph({ nodes: [], edges: [] });
    setMessages([]);
    setDocumentText("");
    setInitialized(false);
    setStudentProgress(DEFAULT_STUDENT);
    setSeedSuggestions(DEFAULT_SEEDS);
    setViewMode("edit");
    setMasteryMode("score");
    setShowSuggestions(false);
  };

  return (
    <main className="h-screen flex flex-col bg-[#1a1a1a]">
      <header className="flex items-center justify-between px-6 py-3 bg-[#141414] border-b border-[#2a2a2a] flex-shrink-0">
        <div>
          <h1 className="text-sm font-medium text-[#e8e8e8] tracking-wide">jbl prototype</h1>
          <p className="text-xs text-[#555]">knowledge graph generator + editor</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

          {/* Suggestions toggle */}
          {initialized && (
            <button
              onClick={() => setShowSuggestions((s) => !s)}
              className="text-xs border rounded px-3 py-1.5 transition-colors"
              style={
                showSuggestions
                  ? { color: "#f0b429", borderColor: "#f0b429", background: "#1a1400" }
                  : { color: "#555", borderColor: "#2a2a2a" }
              }
            >
              suggestions{showSuggestions ? " ●" : ""}
            </button>
          )}

          {viewMode === "progress" && (
            <button
              onClick={() => setMasteryMode((m) => (m === "score" ? "bkt" : "score"))}
              className="text-xs border rounded px-3 py-1.5 transition-colors"
              style={
                masteryMode === "bkt"
                  ? { color: "#a78bfa", borderColor: "#7c3aed" }
                  : { color: "#4dd4d4", borderColor: "#2ab8b8" }
              }
            >
              {masteryMode === "score" ? "score mode" : "bkt mode"}
            </button>
          )}

          <button
            onClick={handleViewModeToggle}
            className="text-xs border rounded px-3 py-1.5 transition-colors"
            style={
              viewMode === "progress"
                ? { color: "#4dd4d4", borderColor: "#2ab8b8" }
                : { color: "#555", borderColor: "#2a2a2a" }
            }
          >
            {viewMode === "edit" ? "edit view" : "progress view"}
          </button>

          {viewMode === "progress" && (
            <button
              onClick={handleResetProgress}
              className="text-xs text-[#555] hover:text-[#f97316] border border-[#2a2a2a] hover:border-[#f97316] rounded px-3 py-1.5 transition-colors"
            >
              reset progress
            </button>
          )}

          <button
            onClick={handleReset}
            className="text-xs text-[#555] hover:text-[#e05252] border border-[#2a2a2a] hover:border-[#e05252] rounded px-3 py-1.5 transition-colors"
          >
            reset session
          </button>
        </div>
      </header>

      {!initialized ? (
        <UploadPanel onGraphGenerated={handleGraphGenerated} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 border-r border-[#2a2a2a]">
            <GraphCanvas
              graph={graph}
              onNodeMove={handleNodeMove}
              viewMode={viewMode}
              masteryMode={masteryMode}
              displayModel={displayModel}
              studentProgress={studentProgress}
              onScoreSubmit={handleScoreSubmit}
              onSuggestionApprove={handleSuggestionApprove}
              onSuggestionDismiss={handleSuggestionDismiss}
            />
          </div>
          <div className="w-1/2 flex flex-col overflow-hidden bg-[#141414]">
            <ChatPanel
              graph={graph}
              messages={messages}
              onGraphUpdate={setGraph}
              onMessagesUpdate={setMessages}
            />
          </div>
        </div>
      )}
    </main>
  );
}
