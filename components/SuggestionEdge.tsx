"use client";

import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";

if (typeof document !== "undefined" && !document.getElementById("suggestion-pulse-style")) {
  const style = document.createElement("style");
  style.id = "suggestion-pulse-style";
  style.textContent = `
    @keyframes suggestion-pulse {
      0%, 100% { box-shadow: 0 0 0 0 #f0b42922; opacity: 0.75; }
      50% { box-shadow: 0 0 0 10px #f0b42900; opacity: 1.0; }
    }
  `;
  document.head.appendChild(style);
}

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
