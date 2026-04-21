"use client";

import { useEffect, useMemo } from "react";
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
import { GraphState } from "@/lib/types";

interface Props {
  graph: GraphState;
  onNodeMove: (id: string, x: number, y: number) => void;
}

interface NodeData {
  label: string;
  topic: string;
  description?: string;
  nodeId: string;
  color: TopicColor;
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

function CustomNode({ data }: NodeProps<NodeData>) {
  const { color } = data;

  return (
    <div className="relative group">
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color.border, border: "none", width: 6, height: 6 }}
      />
      <div
        style={{
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
        }}
      >
        {data.label}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color.border, border: "none", width: 6, height: 6 }}
      />

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
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function toRFNodes(graph: GraphState, colorMap: Map<string, TopicColor>): Node<NodeData>[] {
  return graph.nodes.map((n) => ({
    id: n.id,
    data: {
      label: n.label,
      topic: n.topic,
      description: n.description,
      nodeId: n.id,
      color: colorMap.get(n.topic) ?? TOPIC_PALETTE[0],
    },
    position: n.position ?? { x: 0, y: 0 },
    type: "custom",
  }));
}

function toRFEdges(graph: GraphState): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: false,
    style: { stroke: "#3a3a3a" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3a3a3a", width: 16, height: 16 },
  }));
}

function GraphCanvasInner({ graph, onNodeMove }: Props) {
  const colorMap = useMemo(() => buildTopicColorMap(graph.nodes), [graph.nodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(toRFNodes(graph, colorMap));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(graph));

  useEffect(() => {
    setNodes(toRFNodes(graph, colorMap));
  }, [graph.nodes, colorMap, setNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setEdges(toRFEdges(graph));
  }, [graph.edges, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragStop: NodeDragHandler = (_event, node) => {
    onNodeMove(node.id, node.position.x, node.position.y);
  };

  if (graph.nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#444] text-xs">
        no graph yet
      </div>
    );
  }

  return (
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
  );
}

export default function GraphCanvas({ graph, onNodeMove }: Props) {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%", background: "#1a1a1a" }}>
        <GraphCanvasInner graph={graph} onNodeMove={onNodeMove} />
      </div>
    </ReactFlowProvider>
  );
}
