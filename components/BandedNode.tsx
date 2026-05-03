"use client";

import { NodeProps, Handle, Position } from "reactflow";
import { GradeBand, MasteryState } from "@/lib/types";

export interface BandedNodeData {
  label: string;
  nodeId: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
  masteryState: MasteryState;
  isFrontier: boolean;
  gradeBand: GradeBand;
  fillPct: number;
  pMastery: number;
  labelOpacity: number;
  borderThicknessPx: number;
  onNodeClick?: (nodeId: string, rect: DOMRect) => void;
}

const FILL_COLOR: Record<GradeBand, string> = {
  not_started: "transparent",
  developing: "#2ab8b814",
  progressing: "#2ab8b81a",
  proficient: "#2ab8b822",
  mastered: "#2ab8b82a",
  struggling: "#f43f6e14",
};

const TICK_POSITIONS = [45, 70, 90];

export default function BandedNode({ data }: NodeProps<BandedNodeData>) {
  const {
    label, nodeId, borderColor, textColor, bgColor,
    masteryState, isFrontier, gradeBand,
    fillPct, labelOpacity, borderThicknessPx,
    onNodeClick,
  } = data;

  const isStruggling = gradeBand === "struggling";
  const isMastered = gradeBand === "mastered";
  const handleBg = isStruggling ? "#f43f6e" : borderColor;

  return (
    <div
      className="relative"
      onClick={(e) => {
        if (onNodeClick) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onNodeClick(nodeId, rect);
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: handleBg, border: "none", width: 6, height: 6 }}
      />

      {isFrontier && (
        <div
          style={{
            position: "absolute",
            inset: "-5px",
            borderRadius: "8px",
            border: `2px solid ${borderColor}`,
            animation: "frontier-pulse 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: "-16px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "8px",
          fontFamily: "monospace",
          color: isStruggling ? "#f43f6e" : "#4dd4d4",
          opacity: labelOpacity,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {gradeBand.replace("_", " ")}
      </div>

      <div
        style={{
          background: bgColor,
          color: textColor,
          border: `${borderThicknessPx}px solid ${isStruggling ? "#f43f6e" : borderColor}`,
          borderRadius: "4px",
          padding: "5px 12px",
          fontSize: "11px",
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          position: "relative",
          overflow: "hidden",
          opacity: masteryState === "locked" ? 0.3 : 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct}%`,
            background: FILL_COLOR[gradeBand],
            pointerEvents: "none",
            transition: "width 0.4s ease",
          }}
        />

        {!isMastered &&
          TICK_POSITIONS.map((pos) => {
            const passed = fillPct >= pos;
            const tickColor = isStruggling
              ? (passed ? "#f43f6e66" : "#f43f6e33")
              : (passed ? "#2ab8b866" : "#2ab8b833");
            return (
              <div
                key={pos}
                style={{
                  position: "absolute",
                  left: `${pos}%`,
                  top: "8%",
                  bottom: "8%",
                  width: "1px",
                  background: tickColor,
                  pointerEvents: "none",
                }}
              />
            );
          })}

        <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: handleBg, border: "none", width: 6, height: 6 }}
      />
    </div>
  );
}
