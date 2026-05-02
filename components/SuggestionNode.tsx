"use client";

import { NodeProps, Handle, Position } from "reactflow";

export interface SuggestionNodeData {
  label: string;
  suggestionId: string;
  onSuggestionClick?: (suggestionId: string, rect: DOMRect) => void;
}

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

export default function SuggestionNode({ data }: NodeProps<SuggestionNodeData>) {
  const { label, suggestionId, onSuggestionClick } = data;

  return (
    <div
      onClick={(e) => {
        if (onSuggestionClick) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onSuggestionClick(suggestionId, rect);
        }
      }}
      style={{
        background: "#131000",
        border: "1.5px dashed #f0b429",
        borderRadius: "4px",
        padding: "5px 12px",
        fontSize: "11px",
        color: "#f0b429",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        animation: "suggestion-pulse 2.2s ease-in-out infinite",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#f0b429", border: "none", width: 6, height: 6 }}
      />
      <span style={{ marginRight: "4px", fontSize: "8px" }}>◆</span>
      {label}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#f0b429", border: "none", width: 6, height: 6 }}
      />
    </div>
  );
}
