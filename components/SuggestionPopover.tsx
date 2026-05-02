"use client";

import { useEffect, useRef } from "react";
import { Suggestion } from "@/lib/types";

interface Props {
  suggestion: Suggestion;
  onApprove: (suggestion: Suggestion) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export default function SuggestionPopover({ suggestion, onApprove, onDismiss, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const title =
    suggestion.type === "bridge_node"
      ? suggestion.label
      : `${suggestion.sourceNodeId} → ${suggestion.targetNodeId}`;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        zIndex: 1000,
        background: "#0f0f0f",
        border: "1px solid #f0b429",
        borderRadius: "4px",
        padding: "12px 14px",
        width: "220px",
        fontFamily: "monospace",
        pointerEvents: "all",
      }}
    >
      <p style={{ color: "#f0b429", fontSize: "11px", fontWeight: 500, marginBottom: "4px" }}>
        {title}
      </p>
      <p style={{ color: "#555", fontSize: "9px", marginBottom: "12px", lineHeight: "1.4" }}>
        {suggestion.reason}
      </p>
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={() => { onApprove(suggestion); onClose(); }}
          style={{
            flex: 1,
            background: "#f0b429",
            color: "#0f0f0f",
            fontSize: "10px",
            fontWeight: 600,
            borderRadius: "3px",
            padding: "5px 0",
            border: "none",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          approve
        </button>
        <button
          onClick={() => { onDismiss(suggestion.id); onClose(); }}
          style={{
            flex: 1,
            background: "transparent",
            color: "#555",
            fontSize: "10px",
            borderRadius: "3px",
            padding: "5px 0",
            border: "1px solid #2a2a2a",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          dismiss
        </button>
      </div>
    </div>
  );
}
