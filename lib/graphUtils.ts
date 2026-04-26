import { GraphNode, GraphEdge, GraphState, MasteryState, MasteryMode, NodeProgress, StudentProgress, AssessmentResponse, BKTParams } from "./types";

export function assignPositions(
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphNode[] {
  // Topological sort (Kahn's algorithm) for DAG layout
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  });

  edges.forEach((e) => {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    children.get(e.source)?.push(e.target);
  });

  // BFS layer assignment
  const layers: string[][] = [];
  let frontier = nodes.map((n) => n.id).filter((id) => inDegree.get(id) === 0);

  const assigned = new Set<string>();
  while (frontier.length > 0) {
    layers.push(frontier);
    frontier.forEach((id) => assigned.add(id));
    const next: string[] = [];
    frontier.forEach((id) => {
      (children.get(id) ?? []).forEach((child) => {
        const deg = (inDegree.get(child) ?? 1) - 1;
        inDegree.set(child, deg);
        if (deg === 0 && !assigned.has(child)) next.push(child);
      });
    });
    frontier = next;
  }

  // Any nodes not reached (cycles or disconnected) go in a final layer
  const unreached = nodes.map((n) => n.id).filter((id) => !assigned.has(id));
  if (unreached.length > 0) layers.push(unreached);

  const positioned = new Map<string, { x: number; y: number }>();
  const X_GAP = 320;
  const Y_GAP = 140;

  layers.forEach((layer, layerIndex) => {
    const totalWidth = (layer.length - 1) * X_GAP;
    layer.forEach((id, i) => {
      positioned.set(id, {
        x: i * X_GAP - totalWidth / 2 + 600,
        y: layerIndex * Y_GAP + 80,
      });
    });
  });

  return nodes.map((n) => ({
    ...n,
    position: positioned.get(n.id) ?? { x: 100, y: 500 },
  }));
}

type ToolResult =
  | { graph: GraphState; result: string }
  | { error: string };

export function executeTool(
  name: string,
  input: unknown,
  graph: GraphState
): ToolResult {
  const g: GraphState = JSON.parse(JSON.stringify(graph));
  const inp = input as Record<string, unknown>;

  switch (name) {
    case "get_graph_state": {
      return { graph: g, result: JSON.stringify(g, null, 2) };
    }

    case "add_node": {
      const id = inp.id as string;
      const label = inp.label as string;
      const topic = inp.topic as string;
      const description = inp.description as string | undefined;

      if (g.nodes.some((n) => n.id === id)) {
        return { error: `Node with id "${id}" already exists.` };
      }

      const position = {
        x: 100 + g.nodes.length * 150,
        y: 600,
      };

      g.nodes.push({ id, label, topic, description, position });
      return { graph: g, result: `Added node "${id}" (topic: ${topic}, label: ${label}).` };
    }

    case "remove_node": {
      const node_id = inp.node_id as string;
      const nodeIndex = g.nodes.findIndex((n) => n.id === node_id);

      if (nodeIndex === -1) {
        return { error: `Node "${node_id}" does not exist.` };
      }

      g.nodes.splice(nodeIndex, 1);
      g.edges = g.edges.filter(
        (e) => e.source !== node_id && e.target !== node_id
      );

      return {
        graph: g,
        result: `Removed node "${node_id}" and all its connected edges.`,
      };
    }

    case "update_node": {
      const node_id = inp.node_id as string;
      const node = g.nodes.find((n) => n.id === node_id);

      if (!node) {
        return { error: `Node "${node_id}" does not exist.` };
      }

      if (inp.label !== undefined) node.label = inp.label as string;
      if (inp.description !== undefined) node.description = inp.description as string;
      if (inp.topic !== undefined) node.topic = inp.topic as string;

      return { graph: g, result: `Updated node "${node_id}".` };
    }

    case "add_edge": {
      const source_id = inp.source_id as string;
      const target_id = inp.target_id as string;
      const label = (inp.label as string) ?? "prerequisite";

      if (!g.nodes.some((n) => n.id === source_id)) {
        return { error: `Source node "${source_id}" does not exist.` };
      }
      if (!g.nodes.some((n) => n.id === target_id)) {
        return { error: `Target node "${target_id}" does not exist.` };
      }
      if (g.edges.some((e) => e.source === source_id && e.target === target_id)) {
        return { error: `Edge from "${source_id}" to "${target_id}" already exists.` };
      }

      const id = `${source_id}->${target_id}`;
      g.edges.push({ id, source: source_id, target: target_id, label });

      return {
        graph: g,
        result: `Added edge from "${source_id}" to "${target_id}" (${label}).`,
      };
    }

    case "remove_edge": {
      const source_id = inp.source_id as string;
      const target_id = inp.target_id as string;
      const edgeIndex = g.edges.findIndex(
        (e) => e.source === source_id && e.target === target_id
      );

      if (edgeIndex === -1) {
        return { error: `Edge from "${source_id}" to "${target_id}" does not exist.` };
      }

      g.edges.splice(edgeIndex, 1);
      return {
        graph: g,
        result: `Removed edge from "${source_id}" to "${target_id}".`,
      };
    }

    case "update_edge": {
      const source_id = inp.source_id as string;
      const target_id = inp.target_id as string;
      const label = inp.label as string;
      const edge = g.edges.find(
        (e) => e.source === source_id && e.target === target_id
      );

      if (!edge) {
        return { error: `Edge from "${source_id}" to "${target_id}" does not exist.` };
      }

      edge.label = label;
      return {
        graph: g,
        result: `Updated edge from "${source_id}" to "${target_id}" label to "${label}".`,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function computeBKT(responses: AssessmentResponse[], params: BKTParams): number {
  let pL = params.pL0;
  for (const r of responses) {
    if (r.correct) {
      pL = (pL * (1 - params.pS)) / (pL * (1 - params.pS) + (1 - pL) * params.pG);
    } else {
      pL = (pL * params.pS) / (pL * params.pS + (1 - pL) * (1 - params.pG));
    }
    pL = pL + (1 - pL) * params.pT;
  }
  return pL;
}

export function computeMasteryStates(
  graph: GraphState,
  progress: StudentProgress,
  masteryMode: MasteryMode = 'score'
): Record<string, MasteryState> {
  const prereqs = new Map<string, string[]>();
  graph.nodes.forEach((n) => prereqs.set(n.id, []));
  graph.edges.forEach((e) => {
    prereqs.get(e.target)?.push(e.source);
  });

  const result: Record<string, MasteryState> = {};

  // Build the set of nodes considered "mastered" for prerequisite unlock checks
  const masteredSet = new Set<string>();
  graph.nodes.forEach((n) => {
    const np = progress.nodeProgress[n.id];
    if (!np) return;
    if (masteryMode === 'bkt') {
      if ((np.pMastery ?? 0) >= 0.90) masteredSet.add(n.id);
    } else {
      if (np.score !== undefined && np.score >= 80) masteredSet.add(n.id);
    }
  });

  graph.nodes.forEach((n) => {
    const np = progress.nodeProgress[n.id];
    const prereqList = prereqs.get(n.id) ?? [];
    const allPrereqsMastered = prereqList.every((pid) => masteredSet.has(pid));

    if (!allPrereqsMastered) {
      result[n.id] = 'locked';
      return;
    }

    if (masteryMode === 'bkt') {
      if (!np || np.pMastery === undefined) {
        result[n.id] = 'available';
        return;
      }
      if (np.pMastery >= 0.90) {
        result[n.id] = 'mastered';
        return;
      }
      if (np.attempts >= 3 && np.pMastery < 0.40) {
        result[n.id] = 'struggling';
        return;
      }
      result[n.id] = 'in_progress';
    } else {
      if (!np || np.score === undefined) {
        result[n.id] = 'available';
        return;
      }
      if (np.score >= 80) {
        result[n.id] = 'mastered';
        return;
      }
      if (np.attempts >= 3 && np.score < 50) {
        result[n.id] = 'struggling';
        return;
      }
      result[n.id] = 'in_progress';
    }
  });

  return result;
}
