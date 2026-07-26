export type VertexId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Vertex = {
  id: VertexId;
  label: string;
  icon: string;
  x: number;
  y: number;
};

export type Edge = {
  id: string;
  from: VertexId;
  to: VertexId;
  baseTime: number;
  congestion: number;
};

export type WeightedEdge = Edge & {
  weight: number;
};

export type DijkstraIteration = {
  iteration: number;
  current: VertexId | null;
  visited: VertexId[];
  queue: Array<{ vertex: VertexId; distance: number }>;
  distancesBefore: Record<VertexId, number>;
  distancesAfter: Record<VertexId, number>;
  relaxations: Array<{
    edge: string;
    from: VertexId;
    to: VertexId;
    previous: number;
    currentDistance: number;
    edgeWeight: number;
    candidate: number;
    result: number;
    changed: boolean;
  }>;
};

export type ShortestPathResult = {
  path: VertexId[];
  cost: number;
  iterations: DijkstraIteration[];
  previous: Partial<Record<VertexId, VertexId>>;
  distances: Record<VertexId, number>;
};

export const initialVertices: Vertex[] = [
  { id: "A", label: "School", icon: "🏫", x: 9, y: 48 },
  { id: "B", label: "Café", icon: "☕", x: 39, y: 22 },
  { id: "C", label: "Buildings", icon: "🏢", x: 39, y: 48 },
  { id: "D", label: "Train Station", icon: "🚉", x: 58, y: 66 },
  { id: "E", label: "Cinema", icon: "🎬", x: 70, y: 48 },
  { id: "F", label: "Burger Restaurant", icon: "🍔", x: 91, y: 72 },
  { id: "G", label: "Playground", icon: "🛝", x: 29, y: 78 },
];

export const initialEdges: Edge[] = [
  { id: "AB", from: "A", to: "B", baseTime: 7, congestion: 1.1 },
  { id: "AC", from: "A", to: "C", baseTime: 5, congestion: 1 },
  { id: "BC", from: "B", to: "C", baseTime: 4, congestion: 1 },
  { id: "CD", from: "C", to: "D", baseTime: 5, congestion: 1 },
  { id: "CE", from: "C", to: "E", baseTime: 5, congestion: 1.2 },
  { id: "DF", from: "D", to: "F", baseTime: 6, congestion: 1 },
  { id: "DG", from: "D", to: "G", baseTime: 6, congestion: 1 },
  { id: "EF", from: "E", to: "F", baseTime: 8, congestion: 1 },
  { id: "GF", from: "G", to: "F", baseTime: 9, congestion: 1.1 },
];

export const sourceVertex: VertexId = "A";
export const targetVertex: VertexId = "F";

export const placeName = (id: VertexId) => initialVertices.find((vertex) => vertex.id === id)?.label ?? id;

export const roadName = (edge: Edge) => `${placeName(edge.from)} → ${placeName(edge.to)}`;

export const weightOf = (edge: Edge) => Number((edge.baseTime * edge.congestion).toFixed(1));

export const weightedEdges = (edges: Edge[]): WeightedEdge[] =>
  edges.map((edge) => ({ ...edge, weight: weightOf(edge) }));

export const edgeKey = (a: VertexId, b: VertexId) => [a, b].sort().join("");

export const buildAdjacency = (vertices: Vertex[], edges: Edge[]) => {
  const adjacency = new Map<VertexId, Array<{ vertex: VertexId; edge: WeightedEdge }>>();
  vertices.forEach((vertex) => adjacency.set(vertex.id, []));

  weightedEdges(edges).forEach((edge) => {
    adjacency.get(edge.from)?.push({ vertex: edge.to, edge });
    adjacency.get(edge.to)?.push({ vertex: edge.from, edge });
  });

  adjacency.forEach((neighbors) => neighbors.sort((a, b) => a.vertex.localeCompare(b.vertex)));
  return adjacency;
};

export const makeDistanceRecord = (vertices: Vertex[], initial = Number.POSITIVE_INFINITY) =>
  vertices.reduce(
    (record, vertex) => {
      record[vertex.id] = initial;
      return record;
    },
    {} as Record<VertexId, number>,
  );

export const dijkstra = (
  vertices: Vertex[],
  edges: Edge[],
  source: VertexId,
  target: VertexId,
): ShortestPathResult => {
  const adjacency = buildAdjacency(vertices, edges);
  const distances = makeDistanceRecord(vertices);
  const previous: Partial<Record<VertexId, VertexId>> = {};
  const unvisited = new Set<VertexId>(vertices.map((vertex) => vertex.id));
  const visited: VertexId[] = [];
  const iterations: DijkstraIteration[] = [];

  distances[source] = 0;

  while (unvisited.size > 0) {
    const queue = Array.from(unvisited)
      .map((vertex) => ({ vertex, distance: distances[vertex] }))
      .sort((a, b) => a.distance - b.distance || a.vertex.localeCompare(b.vertex));

    const current = queue[0]?.vertex ?? null;
    if (!current || distances[current] === Number.POSITIVE_INFINITY) break;

    const distancesBefore = { ...distances };
    const relaxations: DijkstraIteration["relaxations"] = [];
    unvisited.delete(current);
    visited.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!unvisited.has(neighbor.vertex)) continue;

      const previousDistance = distances[neighbor.vertex];
      const candidate = Number((distances[current] + neighbor.edge.weight).toFixed(1));
      const nextDistance = Math.min(previousDistance, candidate);

      if (candidate < previousDistance) {
        distances[neighbor.vertex] = candidate;
        previous[neighbor.vertex] = current;
      }

      relaxations.push({
        edge: neighbor.edge.id,
        from: current,
        to: neighbor.vertex,
        previous: previousDistance,
        currentDistance: distancesBefore[current],
        edgeWeight: neighbor.edge.weight,
        candidate,
        result: nextDistance,
        changed: candidate < previousDistance,
      });
    }

    iterations.push({
      iteration: iterations.length + 1,
      current,
      visited: [...visited],
      queue,
      distancesBefore,
      distancesAfter: { ...distances },
      relaxations,
    });

    if (current === target) break;
  }

  const path: VertexId[] = [];
  let cursor: VertexId | undefined = target;

  if (distances[target] !== Number.POSITIVE_INFINITY) {
    while (cursor) {
      path.unshift(cursor);
      cursor = previous[cursor];
    }
  }

  return {
    path,
    cost: distances[target],
    iterations,
    previous,
    distances,
  };
};

export const pathEdges = (path: VertexId[]) => {
  const ids = new Set<string>();
  for (let index = 0; index < path.length - 1; index += 1) {
    ids.add(edgeKey(path[index], path[index + 1]));
  }
  return ids;
};

export const enumeratePaths = (
  vertices: Vertex[],
  edges: Edge[],
  source: VertexId,
  target: VertexId,
  limit = 100,
) => {
  const adjacency = buildAdjacency(vertices, edges);
  const paths: Array<{ path: VertexId[]; cost: number }> = [];

  const visit = (current: VertexId, seen: Set<VertexId>, path: VertexId[], cost: number) => {
    if (paths.length >= limit) return;
    if (current === target) {
      paths.push({ path: [...path], cost: Number(cost.toFixed(1)) });
      return;
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      if (seen.has(neighbor.vertex)) continue;
      seen.add(neighbor.vertex);
      path.push(neighbor.vertex);
      visit(neighbor.vertex, seen, path, cost + neighbor.edge.weight);
      path.pop();
      seen.delete(neighbor.vertex);
    }
  };

  visit(source, new Set([source]), [source], 0);
  return paths.sort((a, b) => a.cost - b.cost || a.path.length - b.path.length);
};

export const formatNumber = (value: number) =>
  value === Number.POSITIVE_INFINITY ? "∞" : Number.isInteger(value) ? `${value}` : value.toFixed(1);

export const formatPath = (path: VertexId[]) => (path.length ? path.join(" → ") : "No connected path");

export const formatPlacePath = (path: VertexId[]) =>
  path.length ? path.map((vertex) => placeName(vertex)).join(" → ") : "No connected path";

export const adjacencyMatrix = (vertices: Vertex[], edges: Edge[]) => {
  const weights = weightedEdges(edges);
  return vertices.map((rowVertex) =>
    vertices.map((columnVertex) => {
      if (rowVertex.id === columnVertex.id) return 0;
      const edge = weights.find(
        (candidate) =>
          (candidate.from === rowVertex.id && candidate.to === columnVertex.id) ||
          (candidate.from === columnVertex.id && candidate.to === rowVertex.id),
      );
      return edge?.weight ?? Number.POSITIVE_INFINITY;
    }),
  );
};

export const graphDensity = (vertices: Vertex[], edges: Edge[]) => {
  const possibleEdges = (vertices.length * (vertices.length - 1)) / 2;
  return possibleEdges === 0 ? 0 : edges.length / possibleEdges;
};
