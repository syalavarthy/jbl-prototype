import Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "get_graph_state",
    description:
      "Returns the current full graph state including all nodes and edges. Call this before making multiple sequential changes to ensure you have the latest state.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "add_node",
    description:
      "Add a new concept node to the knowledge graph. Every node represents a single learnable concept that a student can be taught and tested on.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Unique readable slug e.g. 'understanding-lcm'",
        },
        label: {
          type: "string",
          description: "Short concept name e.g. 'Understanding LCM'",
        },
        topic: {
          type: "string",
          description: "Subject area this concept belongs to e.g. 'Fractions', 'Algebra'",
        },
        description: {
          type: "string",
          description: "One sentence: what the student will be able to do",
        },
      },
      required: ["id", "label", "topic"],
    },
  },
  {
    name: "remove_node",
    description:
      "Remove a concept node from the graph. Also removes all edges connected to this node.",
    input_schema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "ID of the node to remove",
        },
      },
      required: ["node_id"],
    },
  },
  {
    name: "update_node",
    description:
      "Update the label, description, or topic of an existing concept node.",
    input_schema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "ID of the node to update",
        },
        label: { type: "string", description: "New display label" },
        description: { type: "string", description: "New one-sentence description of what the student will be able to do" },
        topic: { type: "string", description: "New topic grouping" },
      },
      required: ["node_id"],
    },
  },
  {
    name: "add_edge",
    description:
      "Add a directed prerequisite edge between two concept nodes. The source concept must be learned before the target concept. The graph must remain a DAG — do not create cycles.",
    input_schema: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "ID of the prerequisite concept (learned first)",
        },
        target_id: {
          type: "string",
          description: "ID of the dependent concept (learned after source)",
        },
        label: {
          type: "string",
          description: "Optional relationship label, defaults to 'prerequisite'",
        },
      },
      required: ["source_id", "target_id"],
    },
  },
  {
    name: "remove_edge",
    description: "Remove a prerequisite edge between two concept nodes.",
    input_schema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        target_id: { type: "string" },
      },
      required: ["source_id", "target_id"],
    },
  },
  {
    name: "update_edge",
    description: "Update the label of an existing edge.",
    input_schema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        target_id: { type: "string" },
        label: { type: "string" },
      },
      required: ["source_id", "target_id", "label"],
    },
  },
];
