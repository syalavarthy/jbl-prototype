"use client";

import ReactMarkdown from "react-markdown";
import { ChatMessage } from "@/lib/types";

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[80%] rounded px-3 py-2 text-xs leading-relaxed break-words ${
          isUser
            ? "bg-[#2a2a2a] text-[#e8e8e8]"
            : "bg-transparent text-[#bbb] border border-[#2a2a2a]"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="text-[#e8e8e8] font-medium">{children}</strong>,
              em: ({ children }) => <em className="text-[#ccc]">{children}</em>,
              code: ({ children }) => (
                <code className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1 py-0.5 text-[#e05252] font-mono">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-2 my-2 overflow-x-auto text-[#aaa]">
                  {children}
                </pre>
              ),
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {isStreaming && (
          <span className="inline-block w-[2px] h-3 ml-0.5 bg-[#e05252] animate-pulse" />
        )}
      </div>
    </div>
  );
}
