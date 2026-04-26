"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatMessage, GraphState, MasteryMode, BKTParams, AssessmentResponse, NodeProgress, StudentProgress } from "@/lib/types";
import GraphCanvas from "@/components/GraphCanvas";
import ChatPanel from "@/components/ChatPanel";
import UploadPanel from "@/components/UploadPanel";
import { computeMasteryStates, computeBKT } from "@/lib/graphUtils";

const STORAGE_KEYS = {
  graph: "kg_graph",
  messages: "kg_messages",
  documentText: "kg_doc_text",
  initialized: "kg_initialized",
  students: "kg_students",
} as const;

const DEFAULT_STUDENT: StudentProgress = {
  studentId: "demo",
  studentName: "Demo Student",
  nodeProgress: {},
};

export default function Home() {
  const [graph, setGraph] = useState<GraphState>({ nodes: [], edges: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documentText, setDocumentText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'progress'>('edit');
  const [masteryMode, setMasteryMode] = useState<MasteryMode>('score');
  const [studentProgress, setStudentProgress] = useState<StudentProgress>(DEFAULT_STUDENT);

  const masteryMap = useMemo(
    () => computeMasteryStates(graph, studentProgress, masteryMode),
    [graph, studentProgress, masteryMode]
  );

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedInitialized = localStorage.getItem(STORAGE_KEYS.initialized);
    if (storedInitialized === "true") {
      const storedGraph = localStorage.getItem(STORAGE_KEYS.graph);
      const storedMessages = localStorage.getItem(STORAGE_KEYS.messages);
      const storedDocText = localStorage.getItem(STORAGE_KEYS.documentText);
      if (storedGraph) setGraph(JSON.parse(storedGraph) as GraphState);
      if (storedMessages) setMessages(JSON.parse(storedMessages) as ChatMessage[]);
      if (storedDocText) setDocumentText(storedDocText);
      const storedStudents = localStorage.getItem(STORAGE_KEYS.students);
      if (storedStudents) setStudentProgress(JSON.parse(storedStudents) as StudentProgress);
      setInitialized(true);
    }
  }, []);

  // Persist state changes to localStorage
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEYS.graph, JSON.stringify(graph));
      localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
      localStorage.setItem(STORAGE_KEYS.documentText, documentText);
      localStorage.setItem(STORAGE_KEYS.initialized, "true");
      localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(studentProgress));
    }
  }, [graph, messages, documentText, initialized, studentProgress]);

  const handleNodeMove = (id: string, x: number, y: number) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n
      ),
    }));
  };

  const handleScoreSubmit = useCallback((nodeId: string, score: number) => {
    setStudentProgress((prev) => {
      const existing = prev.nodeProgress[nodeId];
      const node = graph.nodes.find((n) => n.id === nodeId);
      const dagDepth = node?.position ? Math.round((node.position.y - 80) / 140) : 0;
      const params: BKTParams = existing?.params ?? {
        pL0: Math.min(0.1 + 0.05 * dagDepth, 0.5),
        pT: 0.1,
        pG: 0.2,
        pS: 0.1,
      };
      const newResponse: AssessmentResponse = {
        timestamp: new Date().toISOString(),
        correct: score >= 70,
      };
      const responses = [...(existing?.responses ?? []), newResponse];
      const pMastery = computeBKT(responses, params);
      return {
        ...prev,
        nodeProgress: {
          ...prev.nodeProgress,
          [nodeId]: {
            nodeId,
            score,
            assessedAt: new Date().toISOString(),
            attempts: (existing?.attempts ?? 0) + 1,
            params,
            responses,
            pMastery,
          },
        },
      };
    });
  }, [graph.nodes]);

  const handleViewModeToggle = useCallback(() => {
    setViewMode((m) => (m === 'edit' ? 'progress' : 'edit'));
  }, []);

  const handleGraphGenerated = (newGraph: GraphState, text: string) => {
    setGraph(newGraph);
    setDocumentText(text);
    setInitialized(true);
  };

  const handleResetProgress = useCallback(() => {
    setStudentProgress(DEFAULT_STUDENT);
    setMasteryMode('score');
    if (initialized) {
      localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(DEFAULT_STUDENT));
    }
  }, [initialized]);

  const handleReset = () => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setGraph({ nodes: [], edges: [] });
    setMessages([]);
    setDocumentText("");
    setInitialized(false);
    localStorage.removeItem(STORAGE_KEYS.students);
    setStudentProgress(DEFAULT_STUDENT);
    setViewMode('edit');
    setMasteryMode('score');
  };

  return (
    <main className="h-screen flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#141414] border-b border-[#2a2a2a] flex-shrink-0">
        <div>
          <h1 className="text-sm font-medium text-[#e8e8e8] tracking-wide">
            jbl prototype
          </h1>
          <p className="text-xs text-[#555]">knowledge graph generator + editor</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {viewMode === 'progress' && (
            <button
              onClick={() => setMasteryMode((m) => (m === 'score' ? 'bkt' : 'score'))}
              className="text-xs border rounded px-3 py-1.5 transition-colors"
              style={
                masteryMode === 'bkt'
                  ? { color: "#a78bfa", borderColor: "#7c3aed" }
                  : { color: "#4dd4d4", borderColor: "#2ab8b8" }
              }
            >
              {masteryMode === 'score' ? 'score mode' : 'bkt mode'}
            </button>
          )}
          <button
            onClick={handleViewModeToggle}
            className="text-xs border rounded px-3 py-1.5 transition-colors"
            style={
              viewMode === 'progress'
                ? { color: "#4dd4d4", borderColor: "#2ab8b8" }
                : { color: "#555", borderColor: "#2a2a2a" }
            }
          >
            {viewMode === 'edit' ? 'edit view' : 'progress view'}
          </button>
          {viewMode === 'progress' && (
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

      {/* Body */}
      {!initialized ? (
        <UploadPanel onGraphGenerated={handleGraphGenerated} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Graph canvas — left half */}
          <div className="w-1/2 border-r border-[#2a2a2a]">
            <GraphCanvas
              graph={graph}
              onNodeMove={handleNodeMove}
              viewMode={viewMode}
              masteryMode={masteryMode}
              masteryMap={masteryMap}
              studentProgress={studentProgress}
              onScoreSubmit={handleScoreSubmit}
            />
          </div>

          {/* Chat panel — right half */}
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
