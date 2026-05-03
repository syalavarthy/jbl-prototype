import { getAnthropicClient } from "@/lib/anthropic";
import { assignPositions } from "@/lib/graphUtils";
import { GraphState, SeedSuggestions } from "@/lib/types";

const GENERATE_PROMPT = `You are a curriculum knowledge graph builder. Extract learnable concepts from a curriculum document and arrange them as a DAG. Also emit edge confidence scores and agentic suggestions.

WHAT TO EXTRACT:
- Only include concepts a student can learn, practise, and be tested on
- Prior knowledge concepts are roots (no incoming edges)
- Follow explicit concept sequencing in the document

WHAT TO IGNORE — no nodes for:
- Administrative structures (unit plans, lesson plans, board requirements)
- Time periods or phases (Week 1, Term 2)
- Assessment types (unit test, worksheet)
- Teaching activities (guided practice, revision)

Return a single JSON object with this exact shape:

{
  "nodes": [
    {
      "id": "string",           // readable slug e.g. "understanding-lcm"
      "label": "string",        // short concept name e.g. "Understanding LCM"
      "topic": "string",        // subject area e.g. "Fractions"
      "description": "string"   // one sentence: what the student will be able to do
    }
  ],
  "edges": [
    {
      "id": "string",           // e.g. "understanding-lcm->convert-to-common-denominator"
      "source": "string",
      "target": "string",
      "label": "prerequisite",
      "confidence": 0.0         // 0.0–1.0: 1.0=stated directly, 0.5=implied, 0.3=inferred
    }
  ],
  "suggestions": {
    "bridgeSuggestions": [
      {
        "id": "string",
        "type": "bridge_node",
        "label": "string",
        "sourceNodeId": "string",
        "targetNodeId": "string",
        "reason": "string"
      }
    ],
    "edgeSuggestions": [
      {
        "id": "string",
        "type": "missing_edge",
        "sourceNodeId": "string",
        "targetNodeId": "string",
        "reason": "string"
      }
    ]
  }
}

Include 1–2 bridge suggestions and exactly 1 missing edge suggestion based on the graph structure.

DAG RULES:
- Edges directed from prerequisite to dependent
- No cycles

Return ONLY valid JSON. No explanation, no markdown, no backticks.

Curriculum document:
`;

interface LLMNode {
  id: string;
  label: string;
  topic: string;
  description?: string;
}

interface LLMEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  confidence?: number;
}

interface LLMResponse {
  nodes: LLMNode[];
  edges: LLMEdge[];
  suggestions: {
    bridgeSuggestions: SeedSuggestions['bridgeSuggestions'];
    edgeSuggestions: SeedSuggestions['edgeSuggestions'];
  };
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as { text: string };

  if (!body.text) {
    return Response.json({ error: "No document text provided" }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: GENERATE_PROMPT + body.text }],
    });
  } catch (err) {
    console.error("[/api/generate]", err);
    const msg = err instanceof Error ? err.message : "Claude API error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "No text response from Claude" }, { status: 500 });
  }

  let rawText = textBlock.text.replace(/\`\`\`json\n?|\n?\`\`\`/g, "").trim();
  const jsonStart = rawText.indexOf("{");
  if (jsonStart === -1) {
    return Response.json({ error: "Could not parse graph JSON from response" }, { status: 500 });
  }
  rawText = rawText.slice(jsonStart);

  const llmResponse = JSON.parse(rawText) as LLMResponse;

  const nodesWithPositions = assignPositions(llmResponse.nodes, llmResponse.edges);

  const graph: GraphState = {
    nodes: nodesWithPositions,
    edges: llmResponse.edges,
  };

  const suggestions: SeedSuggestions = {
    bridgeSuggestions: llmResponse.suggestions?.bridgeSuggestions ?? [],
    edgeSuggestions: llmResponse.suggestions?.edgeSuggestions ?? [],
  };

  return Response.json({ graph, suggestions });
}
