# jbl prototype

## Overview

A web app prototype that allows teachers to upload a curriculum document and generate an LLM-powered knowledge graph representing the learning path for a given subject and grade. The teacher interacts with a conversational agent to make changes to the graph in natural language. The graph re-renders in real time as the agent applies changes via tool calls.

A **student progress overlay** lets teachers track a single student's mastery state across the graph. Mastery can be computed via a raw score threshold or full Bayesian Knowledge Tracing (BKT), toggled mid-session without re-entering data.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Frontend UI | React + Tailwind CSS |
| Graph Visualization | React Flow |
| AI Agent | Anthropic Claude API (claude-sonnet-4-5) |
| Document Parsing | `mammoth` |
| Language | TypeScript |

---

## Project Structure

```
/
├── app/
│   ├── page.tsx                  # Main teacher UI — state, view modes, header
│   ├── layout.tsx                # Root layout
│   └── api/
│       ├── upload/
│       │   └── route.ts          # POST: parse Word doc, return extracted text
│       ├── generate/
│       │   └── route.ts          # POST: initial graph generation from document text
│       └── chat/
│           └── route.ts          # POST: streaming agent chat with tool use
├── components/
│   ├── GraphCanvas.tsx           # React Flow graph renderer + mastery overlay
│   ├── AssessPopover.tsx         # Click-to-assess popover for progress mode
│   ├── ChatPanel.tsx             # Conversational agent chat UI
│   ├── UploadPanel.tsx           # Document upload UI
│   └── MessageBubble.tsx         # Individual chat message component
├── lib/
│   ├── anthropic.ts              # Anthropic client singleton
│   ├── tools.ts                  # Agent tool definitions
│   ├── graphUtils.ts             # assignPositions, executeTool, computeMasteryStates, computeBKT
│   └── types.ts                  # Shared TypeScript types
└── .env.local                    # ANTHROPIC_API_KEY
```

---

## Data Models

### Graph State

```typescript
// lib/types.ts

export interface GraphNode {
  id: string;           // Readable slug e.g. "fractions-intro"
  label: string;        // Display name e.g. "Introduction to Fractions"
  topic: string;        // Topic group e.g. "Fractions" — drives color palette
  description?: string;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;           // e.g. "fractions-intro->fractions-addition"
  source: string;
  target: string;
  label?: string;       // e.g. "prerequisite"
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
```

### Student Progress + BKT

```typescript
export type MasteryState = 'locked' | 'available' | 'in_progress' | 'mastered' | 'struggling';

export type MasteryMode = 'score' | 'bkt';

export interface BKTParams {
  pL0: number;   // prior mastery probability — seeded from DAG depth
  pT: number;    // learn rate per attempt (default 0.1)
  pG: number;    // guess rate (default 0.2)
  pS: number;    // slip rate (default 0.1)
}

export interface AssessmentResponse {
  timestamp: string;
  correct: boolean;   // derived from score >= 70 at submission time
}

export interface NodeProgress {
  nodeId: string;
  score?: number;                  // raw 0–100, used by score mode
  assessedAt?: string;
  attempts: number;
  params?: BKTParams;
  responses?: AssessmentResponse[]; // append-only, used by BKT mode
  pMastery?: number;               // recomputed from responses on every submission
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  nodeProgress: Record<string, NodeProgress>;
}
```

---

## View Modes

The app has two view modes toggled via the header:

**Edit mode** — default. Nodes are draggable. Chat panel active. Topic-color rendering.

**Progress mode** — read-only graph. Nodes render with mastery-based visuals. Click any node to open the assess popover and submit a score.

A second toggle (visible only in progress mode) switches between:

- **Score mode** — `mastered = score ≥ 80`, `struggling = attempts ≥ 3 AND score < 50`
- **BKT mode** — `mastered = P(L_t) ≥ 0.90`, `struggling = attempts ≥ 3 AND P(L_t) < 0.40`

Both modes read from the same `NodeProgress` data — switching modes never requires re-entering scores.

### Mastery States

| State | Condition | Visual |
|---|---|---|
| `locked` | One or more prerequisites not yet mastered | 30% opacity, dashed border |
| `available` | All prerequisites mastered, not yet assessed | Default topic color |
| `in_progress` | Assessed but below mastery threshold | Topic color + glow |
| `mastered` | Above mastery threshold | Filled solid, bright |
| `struggling` | 3+ attempts, still below struggling threshold | Red tint border |

**Frontier nodes** — `available` nodes whose prerequisites are all mastered — get an animated pulsing ring. These are the teacher's clearest signal for where to focus.

### BKT Computation

```typescript
// lib/graphUtils.ts
function computeBKT(responses: AssessmentResponse[], params: BKTParams): number
```

Pure function. Replays the full response history on every submission (O(n) where n = attempts). No API call needed — all computation is frontend-only.

`pL0` is seeded per node from DAG depth: `Math.min(0.1 + 0.05 * dagDepth, 0.5)`, using `position.y` from `assignPositions`.

---

## Workflow

### Phase 1: Document Upload and Initial Graph Generation

```
1. Teacher uploads a .docx curriculum document via UploadPanel
2. Frontend POST /api/upload — mammoth extracts plain text
3. Frontend POST /api/generate — Claude returns a JSON graph (nodes + edges)
4. Graph is auto-laid out via topological sort (Kahn's algorithm) and rendered
5. Agent conversation is initialized with the graph state as context
```

Initial generation is a plain LLM call — no tools, structured JSON output only.

### Phase 2: Agent Editing via Chat

```
1. Teacher types a natural language instruction in the chat panel
2. Frontend POST /api/chat with: conversation history + current graph + new message
3. Claude streams a response and/or issues tool calls
4. For each tool call: API executes and validates the mutation, sends result back to Claude
5. Final updated graph is streamed to the frontend and React Flow re-renders
```

### Phase 3: Student Progress Assessment

```
1. Teacher switches to progress view via header toggle
2. Graph re-renders with mastery-state visuals for the tracked student
3. Teacher clicks a node → AssessPopover opens
4. Teacher enters a score (0–100) and submits
5. Score is stored as raw value (score mode) and as correct/incorrect response (BKT mode)
6. pMastery is recomputed; masteryMap updates; graph re-renders
```

---

## API Routes

### POST `/api/upload`
Accepts multipart form with `.docx` file. Returns `{ text: string, filename: string }`.

### POST `/api/generate`
Input: `{ text: string, subject?: string, grade?: string }`. Returns `{ graph: GraphState }`.

### POST `/api/chat`
Input: `{ messages: ChatMessage[], graph: GraphState, userMessage: string }`.
Output: `ReadableStream` with events:
- `{ type: "text", content: string }` — Claude's text response chunk
- `{ type: "graph_update", graph: GraphState }` — updated graph after tool calls
- `{ type: "done" }`

---

## Agent Tool Definitions

Defined in `lib/tools.ts`. Seven tools: `get_graph_state`, `add_node`, `remove_node`, `update_node`, `add_edge`, `remove_edge`, `update_edge`.

Tool execution and validation lives in `executeTool()` in `lib/graphUtils.ts`. Validation errors are returned to Claude as tool results so it can self-correct.

---

## Session Persistence

Single active session at a time. All state is in `localStorage` under fixed keys.

```typescript
const STORAGE_KEYS = {
  graph: "kg_graph",           // GraphState JSON
  messages: "kg_messages",     // ChatMessage[] JSON
  documentText: "kg_doc_text", // Raw extracted document text
  initialized: "kg_initialized", // boolean
  students: "kg_students",     // StudentProgress JSON
}
```

**Reset session** — clears all keys, returns to upload screen.

**Reset progress** (visible in progress mode only) — clears `kg_students` and resets mastery mode to score, without touching the graph or conversation.

---

## Environment Variables

```
# .env.local
ANTHROPIC_API_KEY=your_api_key_here
```
