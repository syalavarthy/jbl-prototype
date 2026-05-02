"use client";

import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";

export interface ConfidenceEdgeData {
  confidence: number;
  isDashed: boolean;
  confidenceLabel: string;
  edgeColor: string;
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
              fontSize: 8,
              fontFamily: "monospace",
              color: "#444",
              pointerEvents: "none",
              userSelect: "none",
            }}
            className="nodrag nopan"
          >
            {data.confidenceLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
