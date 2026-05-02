"use client";

import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";

export interface SuggestionEdgeData {
  suggestionId: string;
  onSuggestionClick?: (suggestionId: string, rect: DOMRect) => void;
}

export default function SuggestionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<SuggestionEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#f0b429",
          strokeOpacity: 0.4,
          strokeDasharray: "5 4",
        }}
      />
      {data && (
        <EdgeLabelRenderer>
          <div
            onClick={(e) => {
              if (data.onSuggestionClick) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                data.onSuggestionClick(data.suggestionId, rect);
              }
            }}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: "9px",
              fontFamily: "monospace",
              color: "#f0b429",
              cursor: "pointer",
              padding: "2px 6px",
              border: "1px solid #f0b42955",
              borderRadius: "3px",
              background: "#1a1400",
              animation: "suggestion-pulse 2.2s ease-in-out infinite",
            }}
            className="nodrag nopan"
          >
            add edge
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
