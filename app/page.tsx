"use client";

import { useEffect, useState } from "react";
import { ChatMessage, GraphState } from "@/lib/types";
import GraphCanvas from "@/components/GraphCanvas";
import ChatPanel from "@/components/ChatPanel";
import UploadPanel from "@/components/UploadPanel";

const STORAGE_KEYS = {
  graph: "kg_graph",
  messages: "kg_messages",
  documentText: "kg_doc_text",
  initialized: "kg_initialized",
} as const;

export default function Home() {
  const [graph, setGraph] = useState<GraphState>({ nodes: [], edges: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documentText, setDocumentText] = useState("");
  const [initialized, setInitialized] = useState(false);

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
    }
  }, [graph, messages, documentText, initialized]);

  const handleNodeMove = (id: string, x: number, y: number) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n
      ),
    }));
  };

  const handleGraphGenerated = (newGraph: GraphState, text: string) => {
    setGraph(newGraph);
    setDocumentText(text);
    setInitialized(true);
  };

  const handleReset = () => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setGraph({ nodes: [], edges: [] });
    setMessages([]);
    setDocumentText("");
    setInitialized(false);
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
        <button
          onClick={handleReset}
          className="text-xs text-[#555] hover:text-[#e05252] border border-[#2a2a2a] hover:border-[#e05252] rounded px-3 py-1.5 transition-colors"
        >
          reset session
        </button>
      </header>

      {/* Body */}
      {!initialized ? (
        <UploadPanel onGraphGenerated={handleGraphGenerated} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Graph canvas — left half */}
          <div className="w-1/2 border-r border-[#2a2a2a]">
            <GraphCanvas graph={graph} onNodeMove={handleNodeMove} />
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
