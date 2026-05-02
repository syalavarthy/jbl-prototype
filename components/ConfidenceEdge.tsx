"use client";

import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";

export interface ConfidenceEdgeData {
  confidence: number;
  isDashed: boolean;
  confidenceLabel: string;
  edgeColor: string;
  delta?: "up" | "down" | null;
}

export default function ConfidenceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<ConfidenceEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = data?.edgeColor ?? "#2a2a2a";
  const delta = data?.delta ?? null;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeDasharray: data?.isDashed ? "5 4" : undefined,
        }}
      />
      {data && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              display: "flex",
              alignItems: "center",
              gap: "2px",
              fontSize: 8,
              fontFamily: "monospace",
              color: delta === "up" ? "#4ade80" : delta === "down" ? "#f87171" : "#888",
              pointerEvents: "none",
              userSelect: "none",
              transition: "color 0.3s ease",
            }}
            className="nodrag nopan"
          >
            {data.confidenceLabel}
            {delta === "up" && <span style={{ fontSize: 7 }}>↑</span>}
            {delta === "down" && <span style={{ fontSize: 7 }}>↓</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
