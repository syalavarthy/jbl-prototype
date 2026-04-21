# jbl prototype

## Overview

A web app prototype that allows teachers to upload a curriculum document and generate an LLM-powered knowledge graph representing the learning path for a given subject and grade. The teacher interacts with a conversational agent to make changes to the graph in natural language. The graph re-renders in real time as the agent applies changes via tool calls.

---

## Tech Stack

| Layer | Choice |
|---|---|---|
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
│   ├── page.tsx                  # Main teacher UI page
│   ├── layout.tsx                # Root layout
│   └── api/
│       ├── upload/
│       │   └── route.ts          # POST: parse Word doc, return extracted text
│       ├── generate/
│       │   └── route.ts          # POST: initial graph generation from document text
│       └── chat/
│           └── route.ts          # POST: streaming agent chat with tool use
├── components/
│   ├── GraphCanvas.tsx           # React Flow graph renderer
│   ├── ChatPanel.tsx             # Conversational agent chat UI
│   ├── UploadPanel.tsx           # Document upload UI
│   └── MessageBubble.tsx         # Individual chat message component
├── lib/
│   ├── anthropic.ts              # Anthropic client singleton
│   ├── tools.ts                  # Agent tool definitions
│   ├── graphUtils.ts             # Graph state helpers and validators
│   └── types.ts                  # Shared TypeScript types
├── .env.local                    # ANTHROPIC_API_KEY
└── schematic.md                  # This file
```

---

## Data Models

### Graph State

This is the single source of truth for the graph. It lives in React state on the frontend and is passed to the API on every agent request.

```typescript
// lib/types.ts

export interface GraphNode {
  id: string;           // Readable slug e.g. "fractions-intro"
  label: string;        // Display name e.g. "Introduction to Fractions"
  type: "topic" | "subtopic";
  description?: string; // Optional detail about the learning objective
  position?: {          // React Flow requires x/y position
    x: number;
    y: number;
  };
}

export interface GraphEdge {
  id: string;           // e.g. "fractions-intro->fractions-addition"
  source: string;       // source node id
  target: string;       // target node id
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

---

## Workflow

### Phase 1: Document Upload and Initial Graph Generation

This is a one-time setup flow before the agent is involved.

```
1. Teacher uploads a .docx curriculum document via UploadPanel
2. Frontend POST /api/upload with the file
3. API uses mammoth to extract plain text from the document
4. API returns { text: string } to the frontend
5. Frontend POST /api/generate with the extracted text
6. API makes a single non-streaming Claude call with structured output prompt
7. Claude returns a JSON graph (nodes + edges) representing the curriculum
8. Frontend parses the JSON and sets it as the initial graph state
9. React Flow renders the graph
10. Agent conversation is initialized with the graph state as context
```

**Important:** Initial generation is a plain LLM call, not an agentic call. No tools. Just structured JSON output.

---

### Phase 2: Agent Editing via Chat

Once the graph is rendered, the teacher types natural language instructions in the chat panel.

```
1. Teacher types a message e.g. "Add a subtopic on long division under multiplication"
2. Frontend POST /api/chat with:
   - Full conversation history
   - Current graph state (serialized JSON)
   - Teacher's new message
3. API constructs the messages array and system prompt (including live graph state)
4. API calls Claude with streaming enabled and tool definitions attached
5. Claude streams a text response and/or issues tool calls
6. For each tool call:
   a. API executes the tool (validates inputs, mutates a server-side graph copy)
   b. Sends tool result back to Claude
   c. Frontend receives a stream event indicating graph has been updated
7. When Claude finishes, API streams the final updated graph state to the frontend
8. Frontend updates graph state and React Flow re-renders
9. Claude's text response is displayed in the chat panel
```

---

## API Routes

### POST `/api/upload`

Accepts a multipart form with a `.docx` file. Returns extracted plain text.

```typescript
// Input: FormData with file field
// Output:
{
  text: string;      // Full extracted plain text from the document
  filename: string;
}
```

Uses `mammoth.extractRawText()` internally.

---

### POST `/api/generate`

Takes extracted document text and returns an initial knowledge graph as JSON.

```typescript
// Input:
{
  text: string;      // Extracted curriculum document text
  subject?: string;  // Optional metadata e.g. "Mathematics"
  grade?: string;    // Optional metadata e.g. "Grade 4"
}

// Output:
{
  graph: GraphState; // { nodes: GraphNode[], edges: GraphEdge[] }
}
```

**Claude prompt for this route:**

```
You are a curriculum expert. Given the following curriculum document, extract a structured knowledge graph representing the learning path.

Rules:
- Topics are major subject areas
- Subtopics are specific concepts within a topic
- Edges represent prerequisite relationships (source must be learned before target)
- Use readable slug IDs (e.g. "fractions-intro", "long-division")
- Return ONLY valid JSON. No explanation. No markdown. No backticks.

Format:
{
  "nodes": [
    { "id": "string", "label": "string", "type": "topic|subtopic", "description": "string" }
  ],
  "edges": [
    { "id": "string", "source": "string", "target": "string", "label": "prerequisite" }
  ]
}

Curriculum document:
{text}
```

---

### POST `/api/chat`

The main agentic endpoint. Accepts conversation history and current graph state. Returns a stream.

```typescript
// Input:
{
  messages: ChatMessage[];     // Full conversation history
  graph: GraphState;           // Current graph state
  userMessage: string;         // Latest teacher message
}

// Output: ReadableStream (text/event-stream)
// Stream events:
// { type: "text", content: string }         — Claude's text response chunk
// { type: "graph_update", graph: GraphState } — Updated graph after tool calls
// { type: "done" }                           — Stream complete
```

**System prompt for this route:**

```
You are an expert curriculum knowledge graph editor for a K-12 school.

Your job is to help teachers edit and extend knowledge graphs that represent learning paths for a given subject and grade.

The current knowledge graph state is:
{GRAPH_STATE_JSON}

Rules:
- Always call get_graph_state before making multiple sequential changes to ensure you have the latest state
- Use readable slug IDs when creating new nodes (e.g. "fractions-multiplication")
- Maintain prerequisite logic: foundational topics must come before advanced ones
- After making all tool calls, summarize what you changed in plain language
- If a requested node ID does not exist, tell the teacher and ask for clarification
- Make all necessary tool calls before responding with text
```

---

## Agent Tool Definitions

Defined in `lib/tools.ts` and passed to every `/api/chat` Claude call.

```typescript
export const tools = [
  {
    name: "get_graph_state",
    description: "Returns the current full graph state including all nodes and edges. Call this before making multiple sequential changes to ensure you have the latest state.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "add_node",
    description: "Add a new topic or subtopic node to the knowledge graph.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique readable slug e.g. 'fractions-multiplication'" },
        label: { type: "string", description: "Display name e.g. 'Multiplying Fractions'" },
        topic: { type: "string", description: "Topic name e.g. 'Fractions'" },
        description: { type: "string", description: "Brief description of the learning objective" }
      },
      required: ["id", "label", "type"]
    }
  },
  {
    name: "remove_node",
    description: "Remove a node from the graph. Also removes all edges connected to this node.",
    input_schema: {
      type: "object",
      properties: {
        node_id: { type: "string", description: "ID of the node to remove" }
      },
      required: ["node_id"]
    }
  },
  {
    name: "update_node",
    description: "Update the label, description, or type of an existing node.",
    input_schema: {
      type: "object",
      properties: {
        node_id: { type: "string", description: "ID of the node to update" },
        label: { type: "string", description: "New display label" },
        description: { type: "string", description: "New description" },
        topic: { type: "string", description: "Topic name e.g. 'Fractions'" }
      },
      required: ["node_id"]
    }
  },
  {
    name: "add_edge",
    description: "Add a prerequisite relationship between two nodes. Source must be learned before target.",
    input_schema: {
      type: "object",
      properties: {
        source_id: { type: "string", description: "ID of the prerequisite node" },
        target_id: { type: "string", description: "ID of the node that depends on source" },
        label: { type: "string", description: "Optional relationship label, defaults to 'prerequisite'" }
      },
      required: ["source_id", "target_id"]
    }
  },
  {
    name: "remove_edge",
    description: "Remove a prerequisite relationship between two nodes.",
    input_schema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        target_id: { type: "string" }
      },
      required: ["source_id", "target_id"]
    }
  },
  {
    name: "update_edge",
    description: "Update the label of an existing edge.",
    input_schema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        target_id: { type: "string" },
        label: { type: "string" }
      },
      required: ["source_id", "target_id", "label"]
    }
  }
]
```

---

## Tool Execution Logic

Defined in `lib/graphUtils.ts`. Each tool call from Claude is validated and applied to a mutable graph copy server-side during the streaming loop.

```typescript
// Validation rules before applying any tool:
// add_node    — check no existing node with same id
// remove_node — check node exists; also remove all edges referencing it
// update_node — check node exists
// add_edge    — check both source and target nodes exist; check edge doesn't already exist
// remove_edge — check edge exists
// update_edge — check edge exists

// If validation fails: return error string to Claude so it can self-correct
// If validation passes: apply mutation and return success + updated node/edge
```

---

## Frontend Component Responsibilities

### `UploadPanel.tsx`
- File input accepting `.docx` only
- On upload: calls `/api/upload` then `/api/generate`
- Shows loading state during generation
- On success: passes initial graph to parent state

### `GraphCanvas.tsx`
- Receives `GraphState` as props
- Renders nodes and edges using React Flow
- Styled to differentiate node types by topic
- Re-renders automatically when graph state prop changes

### `ChatPanel.tsx`
- Displays conversation history
- Text input for teacher messages
- On submit: calls `/api/chat` with current graph state + history
- Consumes the stream:
  - Appends text chunks to the current assistant message in real time
  - On `graph_update` event: updates parent graph state → triggers GraphCanvas re-render
- Shows typing indicator while streaming
- Shows tool calls being made live in chat

### `MessageBubble.tsx`
- Renders a single chat message
- Differentiates user vs assistant styling

---

## Session Persistence

### Prototype Scope
The prototype supports a **single active session at a time**. There are no named sessions, no user accounts, and no session switching. The entire app state — conversation history, graph state, and the original document text — is stored in `localStorage` under fixed keys and loaded on page mount.

### localStorage Keys

```typescript
const STORAGE_KEYS = {
  graph: "kg_graph",           // GraphState JSON
  messages: "kg_messages",     // ChatMessage[] JSON
  documentText: "kg_doc_text", // Raw extracted document text
  initialized: "kg_initialized" // boolean — whether a session exists
}
```

### Persistence Behavior

- **On app load:** Read all four keys from localStorage. If `initialized` is true, restore graph + conversation into React state and skip the upload screen. If false, show the upload panel.
- **After initial graph generation:** Save graph, documentText, and set `initialized: true` to localStorage.
- **After every agent response:** Save the updated graph and full conversation history to localStorage.
- **On page refresh:** State is fully restored — the teacher continues exactly where they left off.

### Reset Button

A clearly visible **"Reset Session"** button is present at all times in the UI (top of the page or sidebar). On click:

1. Clear all four localStorage keys
2. Reset all React state (graph, messages, documentText) to empty/null
3. Return the UI to the initial upload screen

This gives a clean slate for a new end-to-end test run without needing to clear browser storage manually. No confirmation dialog is needed for the prototype — a single click resets everything immediately.

### AppState type addition

```typescript
// lib/types.ts — add to existing types

export interface AppSession {
  graph: GraphState;
  messages: ChatMessage[];
  documentText: string;
  initialized: boolean;
}
```

---

## Environment Variables

```
# .env.local
ANTHROPIC_API_KEY=your_api_key_here
```

---
