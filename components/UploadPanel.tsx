"use client";

import { useRef, useState } from "react";
import { GraphState, SeedSuggestions } from "@/lib/types";

interface GenerateApiResponse {
  graph: GraphState;
  suggestions: SeedSuggestions;
}

interface Props {
  onGraphGenerated: (
    graph: GraphState,
    documentText: string,
    suggestions: SeedSuggestions
  ) => void;
}

export default function UploadPanel({ onGraphGenerated }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { setError("you didn't select a file."); return; }
    if (!file.name.endsWith(".docx")) { setError("i said only .docx files pls."); return; }

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json() as { error: string };
        throw new Error(err.error ?? "upload failed");
      }
      const { text } = await uploadRes.json() as { text: string; filename: string };

      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!generateRes.ok) {
        const err = await generateRes.json() as { error: string };
        throw new Error(err.error ?? "graph generation failed");
      }

      const { graph, suggestions } = await generateRes.json() as GenerateApiResponse;
      onGraphGenerated(graph, text, suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "an unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 bg-[#1a1a1a]">
      <div className="border border-[#2a2a2a] rounded-lg p-10 max-w-sm w-full">
        <h2 className="text-sm font-medium text-[#d4d4d4] mb-1">upload curriculum document</h2>
        <p className="text-xs text-[#555] mb-6">.docx only — generates a knowledge graph from your curriculum</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="block w-full text-xs text-[#555] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#2a2a2a] file:bg-transparent file:text-[#888] file:text-xs hover:file:border-[#e05252] hover:file:text-[#e05252] file:transition-colors mb-5 file:cursor-pointer"
          disabled={isLoading}
        />
        {error && <p className="text-[#e05252] text-xs mb-4">{error}</p>}
        <button
          onClick={handleUpload}
          disabled={isLoading}
          className="w-full text-xs border border-[#2a2a2a] hover:border-[#e05252] text-[#888] hover:text-[#e05252] disabled:opacity-30 py-2 px-4 rounded transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              generating graph…
            </span>
          ) : "generate knowledge graph"}
        </button>
      </div>
    </div>
  );
}
