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
import { GraphNode, GraphState, MasteryMode, MasteryState, StudentProgress } from "@/lib/types";
import AssessPopover from "@/components/AssessPopover";

interface Props {
  graph: GraphState;
  onNodeMove: (id: string, x: number, y: number) => void;
  viewMode: 'edit' | 'progress';
  masteryMode: MasteryMode;
  masteryMap: Record<string, MasteryState>;
  studentProgress: StudentProgress;
  onScoreSubmit: (nodeId: string, score: number) => void;
}

interface NodeData {
  label: string;
  topic: string;
  description?: string;
  nodeId: string;
  color: TopicColor;
  viewMode: 'edit' | 'progress';
  masteryState?: MasteryState;
  isFrontier?: boolean;
  onNodeClick?: (nodeId: string, rect: DOMRect) => void;
}

interface TopicColor {
  bg: string;
  border: string;
  text: string;
  tooltipText: string;
}

const TOPIC_PALETTE: TopicColor[] = [
  { bg: "#0e1a1a", border: "#2ab8b8", text: "#4dd4d4", tooltipText: "#4dd4d4" }, // teal
  { bg: "#1a0e1a", border: "#a855f7", text: "#c084fc", tooltipText: "#c084fc" }, // purple
  { bg: "#0e1a0e", border: "#4ade80", text: "#6ee7a0", tooltipText: "#6ee7a0" }, // green
  { bg: "#1a100e", border: "#f97316", text: "#fb923c", tooltipText: "#fb923c" }, // orange
  { bg: "#0e0e1a", border: "#6b8cff", text: "#93a8ff", tooltipText: "#93a8ff" }, // blue
  { bg: "#1a1a0e", border: "#d4b800", text: "#f0d000", tooltipText: "#f0d000" }, // yellow
  { bg: "#1a0e10", border: "#f43f6e", text: "#fb6f92", tooltipText: "#fb6f92" }, // pink
  { bg: "#0e1a16", border: "#34d399", text: "#6ee7b7", tooltipText: "#6ee7b7" }, // emerald
];

function buildTopicColorMap(nodes: GraphState["nodes"]): Map<string, TopicColor> {
  const topics = Array.from(new Set(nodes.map((n) => n.topic).filter(Boolean)));
  const map = new Map<string, TopicColor>();
  topics.forEach((t, i) => {
    map.set(t, TOPIC_PALETTE[i % TOPIC_PALETTE.length]);
  });
  return map;
}

function getMasteryStyles(
  masteryState: MasteryState,
  color: TopicColor
): React.CSSProperties {
  switch (masteryState) {
    case 'locked':
      return {
        background: color.bg,
        color: color.text,
        border: `1px dashed ${color.border}`,
        opacity: 0.3,
      };
    case 'available':
      return {
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        opacity: 1,
      };
    case 'in_progress':
      return {
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        boxShadow: `0 0 8px ${color.border}55`,
        opacity: 1,
      };
    case 'mastered':
      return {
        background: color.border,
        color: '#0f0f0f',
        border: `1px solid ${color.border}`,
        fontWeight: 600,
        opacity: 1,
      };
    case 'struggling':
      return {
        background: color.bg,
        color: '#fb6f92',
        border: '1px solid #f43f6e',
        opacity: 1,
      };
  }
}

function CustomNode({ data }: NodeProps<NodeData>) {
  const { color, viewMode, masteryState, isFrontier, onNodeClick } = data;

  const nodeStyle: React.CSSProperties =
    viewMode === 'progress' && masteryState
      ? {
          borderRadius: "4px",
          padding: "5px 12px",
          fontSize: "11px",
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          ...getMasteryStyles(masteryState, color),
        }
      : {
          background: color.bg,
          color: color.text,
          border: `1px solid ${color.border}`,
          borderRadius: "4px",
          padding: "5px 12px",
          fontSize: "11px",
          fontWeight: "400",
          cursor: "grab",
          userSelect: "none",
          whiteSpace: "nowrap",
        };

  const handleBg = viewMode === 'progress' && masteryState === 'struggling'
    ? '#f43f6e'
    : color.border;

  return (
    <div
      className="relative group"
      onClick={(e) => {
        if (viewMode === 'progress' && onNodeClick) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onNodeClick(data.nodeId, rect);
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: handleBg, border: "none", width: 6, height: 6 }}
      />

      {/* Frontier pulse ring */}
      {viewMode === 'progress' && isFrontier && (
        <div
          style={{
            position: "absolute",
            inset: "-5px",
            borderRadius: "8px",
            border: `2px solid ${color.border}`,
            animation: "frontier-pulse 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={nodeStyle}>{data.label}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: handleBg, border: "none", width: 6, height: 6 }}
      />

      {/* Hover tooltip (edit mode only) */}
      {viewMode === 'edit' && (
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
            <p style={{ color: color.tooltipText, fontSize: "10px", fontWeight: "500", marginBottom: "3px" }}>
              {data.label}
            </p>
            <p style={{ color: "#555", fontSize: "9px", marginBottom: "3px" }}>
              id: {data.nodeId}
            </p>
            <p style={{ color: "#555", fontSize: "9px", marginBottom: data.description ? "4px" : "0" }}>
              topic: {data.topic}
            </p>
            {data.description && (
              <p style={{ color: "#888", fontSize: "9px", lineHeight: "1.4" }}>
                {data.description}
              </p>
            )}
          </div>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `5px solid ${color.border}`,
              margin: "0 auto",
            }}
          />
        </div>
      )}
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('frontier-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'frontier-pulse-style';
  style.textContent = `
    @keyframes frontier-pulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.08); }
    }
  `;
  document.head.appendChild(style);
}

const nodeTypes = { custom: CustomNode };

function toRFNodes(
  graph: GraphState,
  colorMap: Map<string, TopicColor>,
  viewMode: 'edit' | 'progress',
  masteryMap: Record<string, MasteryState>,
  onNodeClick?: (nodeId: string, rect: DOMRect) => void
): Node<NodeData>[] {
  const prereqs = new Map<string, string[]>();
  graph.nodes.forEach((n) => prereqs.set(n.id, []));
  graph.edges.forEach((e) => prereqs.get(e.target)?.push(e.source));

  return graph.nodes.map((n) => {
    const masteryState = masteryMap[n.id];
    const isFrontier =
      viewMode === 'progress' &&
      masteryState === 'available' &&
      (prereqs.get(n.id) ?? []).every((pid) => masteryMap[pid] === 'mastered');

    return {
      id: n.id,
      data: {
        label: n.label,
        topic: n.topic,
        description: n.description,
        nodeId: n.id,
        color: colorMap.get(n.topic) ?? TOPIC_PALETTE[0],
        viewMode,
        masteryState,
        isFrontier,
        onNodeClick,
      },
      position: n.position ?? { x: 0, y: 0 },
      type: "custom",
    };
  });
}

function toRFEdges(
  graph: GraphState,
  viewMode: 'edit' | 'progress',
  masteryMap: Record<string, MasteryState>,
  colorMap: Map<string, TopicColor>
): Edge[] {
  return graph.edges.map((e) => {
    const bothMastered =
      viewMode === 'progress' &&
      masteryMap[e.source] === 'mastered' &&
      masteryMap[e.target] === 'mastered';

    const sourceColor = colorMap.get(
      graph.nodes.find((n) => n.id === e.source)?.topic ?? ''
    );
    const edgeColor = bothMastered ? (sourceColor?.border ?? '#2ab8b8') : '#2a2a2a';

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: bothMastered,
      style: { stroke: edgeColor },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
    };
  });
}

function GraphCanvasInner({ graph, onNodeMove, viewMode, masteryMode, masteryMap, studentProgress, onScoreSubmit }: Props) {
  const colorMap = useMemo(() => buildTopicColorMap(graph.nodes), [graph.nodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(
    toRFNodes(graph, colorMap, viewMode, masteryMap)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toRFEdges(graph, viewMode, masteryMap, colorMap)
  );
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleDragStop: NodeDragHandler = useCallback((_event, node) => {
    onNodeMove(node.id, node.position.x, node.position.y);
  }, [onNodeMove]);

  const handleNodeClick = useCallback(
    (nodeId: string, rect: DOMRect) => {
      if (activeNodeId === nodeId) {
        setActiveNodeId(null);
        setPopoverPos(null);
      } else {
        const wrapperEl = document.querySelector('.react-flow__renderer') as HTMLElement | null;
        const wrapperRect = wrapperEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
        setActiveNodeId(nodeId);
        setPopoverPos({
          x: rect.left - wrapperRect.left + rect.width + 4,
          y: rect.top - wrapperRect.top - 10,
        });
      }
    },
    [activeNodeId]
  );

  useEffect(() => {
    setNodes(toRFNodes(graph, colorMap, viewMode, masteryMap, handleNodeClick));
  }, [graph.nodes, graph.edges, colorMap, viewMode, masteryMap, setNodes, handleNodeClick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setEdges(toRFEdges(graph, viewMode, masteryMap, colorMap));
  }, [graph.edges, viewMode, masteryMap, colorMap, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode !== 'progress') {
      setActiveNodeId(null);
      setPopoverPos(null);
    }
  }, [viewMode]);

  const handlePopoverSubmit = useCallback(
    (score: number) => onScoreSubmit(activeNodeId!, score),
    [onScoreSubmit, activeNodeId]
  );
  const handlePopoverClose = useCallback(
    () => {
      setActiveNodeId(null);
      setPopoverPos(null);
    },
    []
  );

  if (graph.nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#444] text-xs">
        no graph yet
      </div>
    );
  }

  const activeGraphNode = activeNodeId
    ? graph.nodes.find((n) => n.id === activeNodeId)
    : null;
  const activeRFNode = activeNodeId
    ? nodes.find((n) => n.id === activeNodeId)
    : null;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleDragStop}
        fitView
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="#242424" variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls
          style={{
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "4px",
          }}
        />
      </ReactFlow>

      {viewMode === 'progress' && activeGraphNode && activeRFNode && popoverPos && (
        <div
          style={{
            position: "absolute",
            left: popoverPos.x,
            top: popoverPos.y,
            zIndex: 10,
          }}
        >
          <AssessPopover
            node={activeGraphNode}
            progress={studentProgress.nodeProgress[activeNodeId!]}
            masteryState={masteryMap[activeNodeId!] ?? 'available'}
            masteryMode={masteryMode}
            borderColor={activeRFNode.data.color.border}
            textColor={activeRFNode.data.color.text}
            onSubmit={handlePopoverSubmit}
            onClose={handlePopoverClose}
          />
        </div>
      )}
    </div>
  );
}

export default function GraphCanvas({ graph, onNodeMove, viewMode, masteryMode, masteryMap, studentProgress, onScoreSubmit }: Props) {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%", background: "#1a1a1a" }}>
        <GraphCanvasInner
          graph={graph}
          onNodeMove={onNodeMove}
          viewMode={viewMode}
          masteryMode={masteryMode}
          masteryMap={masteryMap}
          studentProgress={studentProgress}
          onScoreSubmit={onScoreSubmit}
        />
      </div>
    </ReactFlowProvider>
  );
}
