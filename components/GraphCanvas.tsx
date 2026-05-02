"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  Node,
  Edge,
  MarkerType,
  NodeProps,
  ReactFlowProvider,
  NodeDragHandler,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphState, MasteryMode, GraphDisplayModel, Suggestion, StudentProgress } from "@/lib/types";
import AssessPopover from "@/components/AssessPopover";
import SuggestionPopover from "@/components/SuggestionPopover";
import BandedNode, { BandedNodeData } from "@/components/BandedNode";
import SuggestionNode, { SuggestionNodeData } from "@/components/SuggestionNode";
import ConfidenceEdge, { ConfidenceEdgeData } from "@/components/ConfidenceEdge";
import SuggestionEdge, { SuggestionEdgeData } from "@/components/SuggestionEdge";

interface Props {
  graph: GraphState;
  onNodeMove: (id: string, x: number, y: number) => void;
  viewMode: "edit" | "progress";
  masteryMode: MasteryMode;
  displayModel: GraphDisplayModel;
  studentProgress: StudentProgress;
  onScoreSubmit: (nodeId: string, score: number) => void;
  onSuggestionApprove: (suggestion: Suggestion) => void;
  onSuggestionDismiss: (id: string) => void;
}

// ─── EditNode (edit mode) ─────────────────────────────────────────────────────

interface EditNodeData {
  label: string;
  topic: string;
  description?: string;
  nodeId: string;
  color: TopicColor;
  outgoingEdges: Array<{ targetLabel: string; confidence: number; isDashed: boolean }>;
}

interface TopicColor {
  bg: string;
  border: string;
  text: string;
}

const TOPIC_PALETTE: TopicColor[] = [
  { bg: "#0e1a1a", border: "#2ab8b8", text: "#4dd4d4" },
  { bg: "#1a0e1a", border: "#a855f7", text: "#c084fc" },
  { bg: "#0e1a0e", border: "#4ade80", text: "#6ee7a0" },
  { bg: "#1a100e", border: "#f97316", text: "#fb923c" },
  { bg: "#0e0e1a", border: "#6b8cff", text: "#93a8ff" },
  { bg: "#1a1a0e", border: "#d4b800", text: "#f0d000" },
  { bg: "#1a0e10", border: "#f43f6e", text: "#fb6f92" },
  { bg: "#0e1a16", border: "#34d399", text: "#6ee7b7" },
];

function buildTopicColorMap(nodes: GraphState["nodes"]): Map<string, TopicColor> {
  const topics = Array.from(new Set(nodes.map((n) => n.topic).filter(Boolean)));
  const map = new Map<string, TopicColor>();
  topics.forEach((t, i) => map.set(t, TOPIC_PALETTE[i % TOPIC_PALETTE.length]));
  return map;
}

function EditNode({ data }: NodeProps<EditNodeData>) {
  const { color, outgoingEdges } = data;
  const hasEdges = outgoingEdges.length > 0;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} style={{ background: color.border, border: "none", width: 6, height: 6 }} />
      <div
        style={{
          background: color.bg,
          color: color.text,
          border: `1px solid ${color.border}`,
          borderRadius: "4px",
          padding: "5px 12px",
          fontSize: "11px",
          cursor: "grab",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color.border, border: "none", width: 6, height: 6 }} />

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div
          style={{
            background: "#0f0f0f",
            border: `1px solid ${color.border}`,
            borderRadius: "4px",
            padding: "8px 10px",
            minWidth: "160px",
            maxWidth: "240px",
          }}
        >
          <p style={{ color: color.text, fontSize: "10px", fontWeight: "500", marginBottom: "3px" }}>{data.label}</p>
          <p style={{ color: "#555", fontSize: "9px", marginBottom: "3px" }}>id: {data.nodeId}</p>
          <p style={{ color: "#555", fontSize: "9px", marginBottom: data.description || hasEdges ? "4px" : "0" }}>
            topic: {data.topic}
          </p>
          {data.description && (
            <p style={{ color: "#888", fontSize: "9px", lineHeight: "1.4", marginBottom: hasEdges ? "6px" : "0" }}>
              {data.description}
            </p>
          )}
          {hasEdges && (
            <>
              <div style={{ borderTop: "1px solid #1e1e1e", marginBottom: "4px" }} />
              <p style={{ color: "#444", fontSize: "9px", marginBottom: "3px" }}>edges out:</p>
              {outgoingEdges.map((e, i) => (
                <p key={i} style={{ color: "#666", fontSize: "9px", fontFamily: "monospace" }}>
                  → {e.targetLabel}&nbsp;&nbsp;{e.confidence.toFixed(1)}{e.isDashed ? " ···" : ""}
                </p>
              ))}
            </>
          )}
        </div>
        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${color.border}`, margin: "0 auto" }} />
      </div>
    </div>
  );
}

// ─── CSS injection ────────────────────────────────────────────────────────────

if (typeof document !== "undefined" && !document.getElementById("frontier-pulse-style")) {
  const style = document.createElement("style");
  style.id = "frontier-pulse-style";
  style.textContent = `
    @keyframes frontier-pulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.08); }
    }
  `;
  document.head.appendChild(style);
}

// ─── Type registries ──────────────────────────────────────────────────────────

const nodeTypes = {
  editNode: EditNode,
  bandedNode: BandedNode,
  suggestionNode: SuggestionNode,
};

const edgeTypes = {
  confidenceEdge: ConfidenceEdge,
  suggestionEdge: SuggestionEdge,
};

// ─── Converters ───────────────────────────────────────────────────────────────

function toRFNodes(
  graph: GraphState,
  colorMap: Map<string, TopicColor>,
  viewMode: "edit" | "progress",
  displayModel: GraphDisplayModel,
  onNodeClick: (nodeId: string, rect: DOMRect) => void,
  onSuggestionClick: (suggestionId: string, rect: DOMRect) => void
): Node[] {
  const prereqs = new Map<string, string[]>();
  graph.nodes.forEach((n) => prereqs.set(n.id, []));
  graph.edges.forEach((e) => prereqs.get(e.target)?.push(e.source));

  const regular: Node[] = graph.nodes.map((n) => {
    const nd = displayModel.nodeDisplays[n.id];
    const color = colorMap.get(n.topic) ?? TOPIC_PALETTE[0];

    if (viewMode === "edit") {
      const outgoingEdges = graph.edges
        .filter((e) => e.source === n.id)
        .map((e) => {
          const targetNode = graph.nodes.find((nn) => nn.id === e.target);
          const ed = displayModel.edgeDisplays[e.id];
          return {
            targetLabel: targetNode?.label ?? e.target,
            confidence: ed?.confidence ?? 0.5,
            isDashed: ed?.isDashed ?? false,
          };
        });

      return {
        id: n.id,
        type: "editNode",
        position: n.position ?? { x: 0, y: 0 },
        data: {
          label: n.label,
          topic: n.topic,
          description: n.description,
          nodeId: n.id,
          color,
          outgoingEdges,
        } satisfies EditNodeData,
      };
    }

    // progress view → BandedNode
    const isFrontier =
      nd?.masteryState === "available" &&
      (prereqs.get(n.id) ?? []).every((pid) => displayModel.nodeDisplays[pid]?.masteryState === "mastered");

    return {
      id: n.id,
      type: "bandedNode",
      position: n.position ?? { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeId: n.id,
        borderColor: nd?.masteryState === "struggling" ? "#f43f6e" : color.border,
        textColor: nd?.masteryState === "struggling" ? "#fb6f92" : color.text,
        bgColor: color.bg,
        masteryState: nd?.masteryState ?? "available",
        isFrontier,
        gradeBand: nd?.gradeBand ?? "not_started",
        fillPct: nd?.fillPct ?? 0,
        pMastery: nd?.pMastery ?? 0,
        labelOpacity: nd?.labelOpacity ?? 0.35,
        borderThicknessPx: nd?.borderThicknessPx ?? 1,
        learningVelocity: nd?.learningVelocity ?? 0,
        onNodeClick,
      } satisfies BandedNodeData,
    };
  });

  const ghosts: Node[] = displayModel.suggestionNodeDisplays.map((snd) => ({
    id: snd.suggestionId,
    type: "suggestionNode",
    position: snd.position,
    data: {
      label: snd.label,
      suggestionId: snd.suggestionId,
      onSuggestionClick,
    } satisfies SuggestionNodeData,
  }));

  return [...regular, ...ghosts];
}

function toRFEdges(
  graph: GraphState,
  viewMode: "edit" | "progress",
  displayModel: GraphDisplayModel,
  colorMap: Map<string, TopicColor>,
  onSuggestionClick: (suggestionId: string, rect: DOMRect) => void
): Edge[] {
  const regular: Edge[] = graph.edges.map((e) => {
    const ed = displayModel.edgeDisplays[e.id];
    const bothMastered =
      viewMode === "progress" &&
      displayModel.nodeDisplays[e.source]?.masteryState === "mastered" &&
      displayModel.nodeDisplays[e.target]?.masteryState === "mastered";
    const sourceColor = colorMap.get(graph.nodes.find((n) => n.id === e.source)?.topic ?? "");
    const edgeColor = bothMastered ? (sourceColor?.border ?? "#2ab8b8") : "#2a2a2a";

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "confidenceEdge",
      animated: bothMastered,
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
      data: {
        confidence: ed?.confidence ?? 0.5,
        isDashed: ed?.isDashed ?? false,
        confidenceLabel: ed?.confidenceLabel ?? "0.5",
        edgeColor,
      } satisfies ConfidenceEdgeData,
    };
  });

  const ghosts: Edge[] = displayModel.suggestionEdgeDisplays.map((sed, idx) => ({
    id: `suggestion-edge-${sed.suggestionId}-${idx}`,
    source: sed.sourceNodeId,
    target: sed.targetNodeId,
    type: "suggestionEdge",
    data: {
      suggestionId: sed.suggestionId,
      onSuggestionClick,
    } satisfies SuggestionEdgeData,
  }));

  return [...regular, ...ghosts];
}

// ─── GraphCanvasInner ─────────────────────────────────────────────────────────

function GraphCanvasInner({
  graph, onNodeMove, viewMode, masteryMode,
  displayModel, studentProgress, onScoreSubmit,
  onSuggestionApprove, onSuggestionDismiss,
}: Props) {
  const colorMap = useMemo(() => buildTopicColorMap(graph.nodes), [graph.nodes]);

  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [suggestionPopoverPos, setSuggestionPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleNodeClick = useCallback((nodeId: string, rect: DOMRect) => {
    if (viewMode !== "progress") return;
    if (activeNodeId === nodeId) {
      setActiveNodeId(null); setPopoverPos(null);
    } else {
      const wrapperEl = document.querySelector(".react-flow__renderer") as HTMLElement | null;
      const wrapperRect = wrapperEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
      setActiveNodeId(nodeId);
      setPopoverPos({ x: rect.left - wrapperRect.left + rect.width + 4, y: rect.top - wrapperRect.top - 10 });
    }
  }, [viewMode, activeNodeId]);

  const handleSuggestionClick = useCallback((suggestionId: string, rect: DOMRect) => {
    if (activeSuggestionId === suggestionId) {
      setActiveSuggestionId(null); setSuggestionPopoverPos(null);
    } else {
      const wrapperEl = document.querySelector(".react-flow__renderer") as HTMLElement | null;
      const wrapperRect = wrapperEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
      setActiveSuggestionId(suggestionId);
      setSuggestionPopoverPos({ x: rect.left - wrapperRect.left + rect.width + 4, y: rect.top - wrapperRect.top - 10 });
    }
  }, [activeSuggestionId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    toRFNodes(graph, colorMap, viewMode, displayModel, handleNodeClick, handleSuggestionClick)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toRFEdges(graph, viewMode, displayModel, colorMap, handleSuggestionClick)
  );

  const handleDragStop: NodeDragHandler = useCallback((_event, node) => {
    onNodeMove(node.id, node.position.x, node.position.y);
  }, [onNodeMove]);

  useEffect(() => {
    setNodes(toRFNodes(graph, colorMap, viewMode, displayModel, handleNodeClick, handleSuggestionClick));
  }, [graph, colorMap, viewMode, displayModel, handleNodeClick, handleSuggestionClick, setNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setEdges(toRFEdges(graph, viewMode, displayModel, colorMap, handleSuggestionClick));
  }, [graph.edges, viewMode, displayModel, colorMap, handleSuggestionClick, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode !== "progress") { setActiveNodeId(null); setPopoverPos(null); }
  }, [viewMode]);

  if (graph.nodes.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-[#444] text-xs">no graph yet</div>;
  }

  const activeGraphNode = activeNodeId ? graph.nodes.find((n) => n.id === activeNodeId) : null;
  const activeRFNode = activeNodeId ? nodes.find((n) => n.id === activeNodeId) : null;
  const activeSuggestion = activeSuggestionId
    ? displayModel.suggestions.find((s) => s.id === activeSuggestionId) ?? null
    : null;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleDragStop}
        fitView
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="#242424" variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "4px" }} />
      </ReactFlow>

      {/* AssessPopover */}
      {viewMode === "progress" && activeGraphNode && activeRFNode && popoverPos && (
        <div style={{ position: "absolute", left: popoverPos.x, top: popoverPos.y, zIndex: 10 }}>
          <AssessPopover
            node={activeGraphNode}
            progress={studentProgress.nodeProgress[activeNodeId!]}
            masteryState={displayModel.nodeDisplays[activeNodeId!]?.masteryState ?? "available"}
            masteryMode={masteryMode}
            borderColor={(activeRFNode.data as BandedNodeData).borderColor}
            textColor={(activeRFNode.data as BandedNodeData).textColor}
            onSubmit={(score) => { onScoreSubmit(activeNodeId!, score); }}
            onClose={() => { setActiveNodeId(null); setPopoverPos(null); }}
          />
        </div>
      )}

      {/* SuggestionPopover */}
      {activeSuggestion && suggestionPopoverPos && (
        <div style={{ position: "absolute", left: suggestionPopoverPos.x, top: suggestionPopoverPos.y, zIndex: 10 }}>
          <SuggestionPopover
            suggestion={activeSuggestion}
            onApprove={onSuggestionApprove}
            onDismiss={onSuggestionDismiss}
            onClose={() => { setActiveSuggestionId(null); setSuggestionPopoverPos(null); }}
          />
        </div>
      )}
    </div>
  );
}

export default function GraphCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%", background: "#1a1a1a" }}>
        <GraphCanvasInner {...props} />
      </div>
    </ReactFlowProvider>
  );
}
