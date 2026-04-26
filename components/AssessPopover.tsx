"use client";

import { useEffect, useRef, useState } from "react";
import { GraphNode, MasteryState, NodeProgress } from "@/lib/types";

interface Props {
  node: GraphNode;
  progress: NodeProgress | undefined;
  masteryState: MasteryState;
  borderColor: string;
  textColor: string;
  onSubmit: (score: number) => void;
  onClose: () => void;
}

export default function AssessPopover({
  node,
  progress,
  masteryState,
  borderColor,
  textColor,
  onSubmit,
  onClose,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit() {
    const score = parseInt(inputValue, 10);
    if (isNaN(score) || score < 0 || score > 100) return;
    onSubmit(score);
    onClose();
  }

  const stateLabel = masteryState.replaceAll("_", " ");
  const hasScore = progress?.score !== undefined;
  const lastDate = progress?.assessedAt
    ? new Date(progress.assessedAt).toISOString().split("T")[0]
    : null;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        zIndex: 1000,
        background: "#0f0f0f",
        border: `1px solid ${borderColor}`,
        borderRadius: "4px",
        padding: "12px 14px",
        width: "200px",
        fontFamily: "monospace",
        pointerEvents: "all",
      }}
    >
      {/* Node label */}
      <p style={{ color: textColor, fontSize: "11px", fontWeight: 500, marginBottom: "2px" }}>
        {node.label}
      </p>

      {/* State + attempts */}
      <p style={{ color: "#555", fontSize: "9px", marginBottom: hasScore ? "2px" : "8px" }}>
        state: {stateLabel} · att: {progress?.attempts ?? 0}
      </p>

      {/* Last score + date */}
      {hasScore && (
        <p style={{ color: "#555", fontSize: "9px", marginBottom: "8px" }}>
          last score: {progress!.score}{lastDate ? ` · ${lastDate}` : ""}
        </p>
      )}

      <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: "8px" }}>
        {masteryState === "locked" ? (
          <p style={{ color: "#555", fontSize: "9px" }}>prerequisites not yet mastered</p>
        ) : (
          <>
            <p style={{ color: "#888", fontSize: "9px", marginBottom: "4px" }}>
              {hasScore ? "new score (0–100)" : "score (0–100)"}
            </p>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="number"
                min={0}
                max={100}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
                style={{
                  flex: 1,
                  background: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "3px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  color: "#e8e8e8",
                  outline: "none",
                  width: 0,
                }}
              />
              <button
                onClick={handleSubmit}
                style={{
                  background: borderColor,
                  color: "#0f0f0f",
                  fontSize: "10px",
                  fontWeight: 600,
                  borderRadius: "3px",
                  padding: "4px 10px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
