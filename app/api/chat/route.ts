import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { tools } from "@/lib/tools";
import { executeTool, assignPositions } from "@/lib/graphUtils";
import { ChatMessage, GraphState, StreamEvent } from "@/lib/types";

const STATIC_SYSTEM_INSTRUCTIONS = `You are an expert curriculum knowledge graph editor for a K-12 school.

Your job is to help teachers edit and extend knowledge graphs that represent learning paths for a given subject and grade.

Graph structure rules:
- Every node represents a single learnable concept — something a student can be taught and tested on
- Every node has a topic attribute that groups it with related concepts (e.g. "Fractions", "Algebra")
- Edges are directed from prerequisite to dependent: source is learned before target
- The graph must remain a valid DAG — never create a cycle

Edge confidence:
- Every edge has an optional confidence value (0.0–1.0) representing how strong/certain the prerequisite relationship is
- 1.0 = the dependency is definitive (e.g. addition before multiplication)
- 0.5 = uncertain or context-dependent connection (default for new edges)
- 0.0 = extremely weak or speculative connection
- Edges with confidence below 0.5 render as dashed lines in the UI to signal a weak link
- Confidence is also updated live by student assessment scores — when you set it, you are setting the initial/override value
- When adding a new edge, set confidence based on how essential the prerequisite truly is; don't default to 1.0 unless it is truly required

Node mastery (read-only context):
- Student progress is tracked via Bayesian Knowledge Tracing (BKT); each node has a pMastery probability (0.0–1.0)
- Grade bands: not_started → developing → progressing → proficient (≥0.70) → mastered (≥0.90)
- A student must reach proficient (pMastery ≥ 0.70) on a node before its dependents unlock
- You cannot set pMastery directly — it is computed from student assessment responses

Editing rules:
- Always call get_graph_state before making multiple sequential changes
- Use readable slug IDs when creating new nodes (e.g. "understanding-lcm")
- After making all tool calls, summarize what you changed in plain language
- If a requested node ID does not exist, tell the teacher and ask for clarification
- Make all necessary tool calls before responding with text`;

function buildSystemPrompt(graph: GraphState): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: STATIC_SYSTEM_INSTRUCTIONS,
      // @ts-expect-error cache_control is supported by the API but may not be in these type defs
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `The current knowledge graph state is:\n${JSON.stringify(graph, null, 2)}`,
    },
  ];
}

function encodeEvent(event: StreamEvent, encoder: TextEncoder): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as {
    messages: ChatMessage[];
    graph: GraphState;
    userMessage: string;
  };

  const { messages, graph, userMessage } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropic = getAnthropicClient();
        let currentGraph: GraphState = JSON.parse(JSON.stringify(graph));

        const currentMessages: Anthropic.MessageParam[] = [
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: userMessage },
        ];

        let iterations = 0;
        let toolUseLoop = true;

        while (toolUseLoop && iterations < 10) {
          iterations++;

          const apiStream = anthropic.messages.stream({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            system: buildSystemPrompt(currentGraph),
            tools: tools,
            messages: currentMessages,
          });

          // Stream text deltas to frontend in real time
          apiStream.on("text", (text) => {
            controller.enqueue(
              encodeEvent({ type: "text", content: text }, encoder)
            );
          });

          const finalMessage = await apiStream.finalMessage();

          if (finalMessage.stop_reason === "tool_use") {
            const toolUseBlocks = finalMessage.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            // Append assistant turn to messages
            currentMessages.push({
              role: "assistant",
              content: finalMessage.content,
            });

            // Execute each tool and collect results
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolBlock of toolUseBlocks) {
              console.log(`[tool_use] ${toolBlock.name}`, JSON.stringify(toolBlock.input, null, 2));
              const outcome = executeTool(
                toolBlock.name,
                toolBlock.input,
                currentGraph
              );

              if ("error" in outcome) {
                controller.enqueue(encodeEvent(
                  { type: "tool_call", name: toolBlock.name, result: outcome.error, isError: true },
                  encoder
                ));
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolBlock.id,
                  content: `ERROR: ${outcome.error}`,
                  is_error: true,
                });
              } else {
                currentGraph = outcome.graph;
                controller.enqueue(encodeEvent(
                  { type: "tool_call", name: toolBlock.name, result: outcome.result, isError: false },
                  encoder
                ));
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolBlock.id,
                  content: outcome.result,
                });
              }
            }

            currentMessages.push({ role: "user", content: toolResults });
          } else {
            toolUseLoop = false;
          }
        }

        // Re-layout the graph before sending back
        currentGraph.nodes = assignPositions(currentGraph.nodes, currentGraph.edges);

        controller.enqueue(
          encodeEvent({ type: "graph_update", graph: currentGraph }, encoder)
        );
        controller.enqueue(encodeEvent({ type: "done" }, encoder));
        controller.close();
      } catch (err) {
        console.error("[/api/chat]", err);
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        controller.enqueue(
          encodeEvent({ type: "text", content: `\n[Error: ${message}]` }, encoder)
        );
        controller.enqueue(encodeEvent({ type: "done" }, encoder));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
