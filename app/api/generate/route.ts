import { getAnthropicClient } from "@/lib/anthropic";
import { assignPositions } from "@/lib/graphUtils";
import { GraphState } from "@/lib/types";

const GENERATE_PROMPT = `You are a curriculum knowledge graph builder. Your job is to extract ONLY the learnable concepts (these may be related to any educational subject like math, physics, chemistry, economics etc.) from a curriculum document and arrange them as a Directed Acyclic Graph (DAG) representing the sequence in which a student must learn them.

WHAT TO EXTRACT:
- Only include concepts that a student can actually learn, practise, and be tested on
- Prior knowledge concepts listed in the document should be included as foundational nodes with no incoming edges
- Follow the concept sequencing order explicitly described in the document (e.g. Week 1 → Week 2 → Week 3)
- Each node must represent one specific learnable concept, not a container, category, phase, or administrative unit

WHAT TO IGNORE — do not create nodes for any of the following:
- Planning or administrative structures (unit plans, annual plans, board requirements, lesson plans)
- Time periods or phases (Week 1, Term 2, Foundation phase)
- Assessment types (unit test, exit ticket, formative assessment, worksheet)
- Teaching activities or methods (guided practice, mixed practice, revision, teacher reflection)
- Pedagogy structures (engagement hook, concept introduction, closure)

NODE STRUCTURE:
Every node represents a single learnable concept and has a topic attribute for grouping.
For this document, the topic for all nodes is "Fractions".

{
  "nodes": [
    {
      "id": "string",          // readable slug e.g. "understanding-lcm"
      "label": "string",       // short concept name e.g. "Understanding LCM"
      "topic": "string",       // the subject area this concept belongs to e.g. "Fractions"
      "description": "string"  // one sentence: what the student will be able to do
    }
  ],
  "edges": [
    {
      "id": "string",          // e.g. "understanding-lcm->convert-to-common-denominator"
      "source": "string",      // id of the prerequisite concept
      "target": "string",      // id of the concept that depends on it
      "label": "prerequisite"
    }
  ]
}

DAG RULES — the graph must be a valid Directed Acyclic Graph:
- Edges are directed from prerequisite to dependent (source is learned before target)
- No cycles — a concept cannot be a prerequisite of its own ancestor
- A concept can have multiple prerequisites (multiple incoming edges)
- A concept can be prerequisite to multiple concepts (multiple outgoing edges)
- Prior knowledge nodes from the document have no incoming edges — they are roots of the graph

Return ONLY valid JSON. No explanation, no markdown, no backticks.

Curriculum document:
`;

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as {
    text: string;
    subject?: string;
    grade?: string;
  };

  if (!body.text) {
    return Response.json({ error: "No document text provided" }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  let message;
  try {
    message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: GENERATE_PROMPT + body.text,
      },
    ],
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

  let rawText = textBlock.text;
  // Strip markdown fences and any leading text before the JSON object
  rawText = rawText.replace(/```json\n?|\n?```/g, "").trim();
  const jsonStart = rawText.indexOf("{");
  if (jsonStart === -1) {
    return Response.json({ error: "Could not parse graph JSON from response" }, { status: 500 });
  }
  console.log(`json response: ${rawText}`)
  rawText = rawText.slice(jsonStart);

  const parsed = JSON.parse(rawText) as GraphState;
  const nodesWithPositions = assignPositions(parsed.nodes, parsed.edges);

  return Response.json({ graph: { nodes: nodesWithPositions, edges: parsed.edges } });
}
