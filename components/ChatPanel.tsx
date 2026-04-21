"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage, GraphState, StreamEvent } from "@/lib/types";
import MessageBubble from "./MessageBubble";

interface Props {
  graph: GraphState;
  messages: ChatMessage[];
  onGraphUpdate: (g: GraphState) => void;
  onMessagesUpdate: (m: ChatMessage[]) => void;
}

// A segment is either a block of text or a tool call chip
type Segment =
  | { kind: "text"; content: string }
  | { kind: "tool"; name: string; result: string; isError: boolean };

function ToolChip({ name, result, isError }: { name: string; result: string; isError: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border transition-colors ${
          isError
            ? "border-[#e05252]/40 text-[#e05252] bg-[#1e0a0a] hover:border-[#e05252]/70"
            : "border-[#2a2a2a] text-[#555] bg-[#1a1a1a] hover:border-[#3a3a3a] hover:text-[#888]"
        }`}
      >
        <span>{isError ? "✕" : "⚙"}</span>
        <span className="font-medium">{name.replace(/_/g, " ")}</span>
        <span className="ml-1 opacity-50">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-2 text-[9px] text-[#555] border-l border-[#2a2a2a] pl-2 leading-relaxed">
          {result}
        </div>
      )}
    </div>
  );
}

function segmentsToStoredContent(segments: Segment[]): string {
  return segments
    .map((s) =>
      s.kind === "text"
        ? s.content.trim()
        : `[tool:${s.name}:${s.isError ? "error" : "ok"}:${s.result}]`
    )
    .filter(Boolean)
    .join("\n\n");
}

function parseStoredContent(content: string): Segment[] {
  const segments: Segment[] = [];
  const toolPattern = /\[tool:([^:]+):(ok|error):([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ kind: "text", content: text });
    }
    segments.push({
      kind: "tool",
      name: match[1],
      result: match[3],
      isError: match[2] === "error",
    });
    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex).trim();
  if (remaining) segments.push({ kind: "text", content: remaining });

  return segments;
}

function AssistantMessage({ content }: { content: string }) {
  const segments = parseStoredContent(content);
  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[88%]">
        {segments.map((seg, i) =>
          seg.kind === "tool" ? (
            <ToolChip key={i} name={seg.name} result={seg.result} isError={seg.isError} />
          ) : (
            <MessageBubble key={i} message={{ role: "assistant", content: seg.content }} />
          )
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({
  graph,
  messages,
  onGraphUpdate,
  onMessagesUpdate,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSegments, setStreamingSegments] = useState<Segment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingSegments]);

  const handleSubmit = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    onMessagesUpdate(updatedMessages);
    setInputValue("");
    setIsStreaming(true);
    setStreamingSegments([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, graph, userMessage: trimmed }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Mutable working copy of segments during streaming
      const segments: Segment[] = [];

      const appendText = (chunk: string) => {
        const last = segments[segments.length - 1];
        if (last?.kind === "text") {
          last.content += chunk;
        } else {
          segments.push({ kind: "text", content: chunk });
        }
        setStreamingSegments([...segments]);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as StreamEvent;

            if (event.type === "text") {
              appendText(event.content);
            } else if (event.type === "tool_call") {
              segments.push({ kind: "tool", name: event.name, result: event.result, isError: event.isError });
              setStreamingSegments([...segments]);
            } else if (event.type === "graph_update") {
              onGraphUpdate(event.graph);
            } else if (event.type === "done") {
              const stored = segmentsToStoredContent(segments);
              onMessagesUpdate([
                ...updatedMessages,
                { role: "assistant", content: stored },
              ]);
              setStreamingSegments([]);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      onMessagesUpdate([
        ...updatedMessages,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
      setStreamingSegments([]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && streamingSegments.length === 0 && (
          <p className="text-center text-[#444] text-xs mt-8">
            describe a change to the graph and i&apos;ll apply it
          </p>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <MessageBubble key={i} message={msg} />
          ) : (
            <AssistantMessage key={i} content={msg.content} />
          )
        )}

        {/* Live streaming segments */}
        {streamingSegments.length > 0 && (
          <div className="flex justify-start mb-2">
            <div className="max-w-[88%]">
              {streamingSegments.map((seg, i) =>
                seg.kind === "tool" ? (
                  <ToolChip key={i} name={seg.name} result={seg.result} isError={seg.isError} />
                ) : (
                  <MessageBubble
                    key={i}
                    message={{ role: "assistant", content: seg.content }}
                    isStreaming={i === streamingSegments.length - 1}
                  />
                )
              )}
            </div>
          </div>
        )}

        {isStreaming && streamingSegments.length === 0 && (
          <div className="flex justify-start mb-2">
            <div className="border border-[#2a2a2a] rounded px-3 py-2 flex gap-1">
              <span className="w-1 h-1 bg-[#555] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-1 bg-[#555] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-1 bg-[#555] rounded-full animate-bounce" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#2a2a2a] p-3 flex gap-2 items-end">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="edit the graph… (enter to send)"
          rows={2}
          disabled={isStreaming}
          className="flex-1 resize-none rounded border border-[#2a2a2a] bg-transparent px-3 py-2 text-xs text-[#e8e8e8] placeholder-[#444] focus:outline-none focus:border-[#e05252] disabled:opacity-30 transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !inputValue.trim()}
          className="text-xs border border-[#2a2a2a] hover:border-[#e05252] text-[#555] hover:text-[#e05252] disabled:opacity-30 rounded px-3 py-2 transition-colors self-end"
        >
          send
        </button>
      </div>
    </div>
  );
}
