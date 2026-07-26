import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Lock,
  Maximize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Route,
  Sigma,
  TrafficCone,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Edge,
  Vertex,
  VertexId,
  dijkstra,
  edgeKey,
  enumeratePaths,
  formatNumber,
  formatPath,
  formatPlacePath,
  initialEdges,
  initialVertices,
  pathEdges,
  roadName,
  sourceVertex,
  targetVertex,
  weightedEdges,
  weightOf,
} from "./graphModel";

type WeightedEdge = ReturnType<typeof weightedEdges>[number];

type RouteUpdate = {
  id: number;
  edgeId: string;
  road: string;
  before: number;
  after: number;
  path: VertexId[];
};

const congestionBands = [
  { label: "Low", color: "#21a67a", max: 1.8 },
  { label: "Medium", color: "#e8bd34", max: 2.8 },
  { label: "Heavy", color: "#f97316", max: 3.9 },
  { label: "Very Heavy", color: "#ef4444", max: 5 },
];

const getCongestionBand = (congestion: number) =>
  congestionBands.find((band) => congestion <= band.max) ?? congestionBands[congestionBands.length - 1];

const clamp = (value: number, min: number, max: number, decimals = 1) =>
  Math.min(max, Math.max(min, Number(value.toFixed(decimals))));

const edgeMidpoint = (edge: Edge, vertices: Vertex[]) => {
  const from = vertices.find((vertex) => vertex.id === edge.from)!;
  const to = vertices.find((vertex) => vertex.id === edge.to)!;
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
};

const edgeLine = (edge: Edge, vertices: Vertex[]) => {
  const from = vertices.find((vertex) => vertex.id === edge.from)!;
  const to = vertices.find((vertex) => vertex.id === edge.to)!;
  return { from, to };
};

function App() {
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedEdgeId, setSelectedEdgeId] = useState("AC");
  const [selectedVertexId, setSelectedVertexId] = useState<VertexId | null>(null);
  const [isAlgorithmOpen, setAlgorithmOpen] = useState(false);
  const [algorithmStep, setAlgorithmStep] = useState(0);
  const [isPlayingAlgorithm, setPlayingAlgorithm] = useState(false);
  const [routeUpdate, setRouteUpdate] = useState<RouteUpdate | null>(null);
  const previousPathRef = useRef<string>("");
  const previousEdgesRef = useRef<Edge[]>(initialEdges);
  const updateIdRef = useRef(0);

  const vertices = initialVertices;
  const weighted = useMemo(() => weightedEdges(edges), [edges]);
  const result = useMemo(() => dijkstra(vertices, edges, sourceVertex, targetVertex), [vertices, edges]);
  const allPaths = useMemo(() => enumeratePaths(vertices, edges, sourceVertex, targetVertex), [vertices, edges]);
  const alternativePath = allPaths.find((path) => path.path.join("-") !== result.path.join("-"));
  const shortestEdgeSet = useMemo(() => pathEdges(result.path), [result.path]);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? edges[0];
  const selectedWeightedEdge = weighted.find((edge) => edge.id === selectedEdge.id)!;
  const selectedBand = getCongestionBand(selectedEdge.congestion);
  const currentStep = result.iterations[Math.min(algorithmStep, Math.max(0, result.iterations.length - 1))];
  const relaxedEdgeIds = new Set(currentStep?.relaxations.map((relaxation) => relaxation.edge) ?? []);
  const visitedNodes = new Set(currentStep?.visited ?? []);
  const timeSaved = alternativePath ? Math.max(0, Number((alternativePath.cost - result.cost).toFixed(1))) : null;
  const improvement =
    alternativePath && alternativePath.cost > 0 ? Number(((Math.max(0, alternativePath.cost - result.cost) / alternativePath.cost) * 100).toFixed(1)) : null;

  useEffect(() => {
    const pathKey = result.path.join("-");
    if (!previousPathRef.current) {
      previousPathRef.current = pathKey;
      previousEdgesRef.current = edges;
      return;
    }

    if (pathKey !== previousPathRef.current) {
      const changedEdge =
        edges
          .map((edge) => {
            const previous = previousEdgesRef.current.find((candidate) => candidate.id === edge.id);
            return previous
              ? { edge, before: weightOf(previous), after: weightOf(edge), delta: Math.abs(weightOf(edge) - weightOf(previous)) }
              : null;
          })
          .filter((change): change is { edge: Edge; before: number; after: number; delta: number } => Boolean(change))
          .sort((a, b) => b.delta - a.delta)[0] ?? { edge: selectedEdge, before: weightOf(selectedEdge), after: weightOf(selectedEdge) };

      updateIdRef.current += 1;
      setRouteUpdate({
        id: updateIdRef.current,
        edgeId: changedEdge.edge.id,
        road: roadName(changedEdge.edge),
        before: changedEdge.before,
        after: changedEdge.after,
        path: result.path,
      });
    }

    previousPathRef.current = pathKey;
    previousEdgesRef.current = edges;
  }, [edges, result.path, selectedEdge]);

  useEffect(() => {
    if (!routeUpdate) return;
    const timeout = window.setTimeout(() => setRouteUpdate(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [routeUpdate]);

  useEffect(() => {
    if (!isPlayingAlgorithm || !isAlgorithmOpen) return;
    const timeout = window.setTimeout(() => {
      setAlgorithmStep((step) => {
        if (step >= result.iterations.length - 1) {
          setPlayingAlgorithm(false);
          return step;
        }
        return step + 1;
      });
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [algorithmStep, isAlgorithmOpen, isPlayingAlgorithm, result.iterations.length]);

  const updateEdge = (edgeId: string, patch: Partial<Pick<Edge, "baseTime" | "congestion">>) => {
    setEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              baseTime: patch.baseTime === undefined ? edge.baseTime : clamp(patch.baseTime, 1, 30, 0),
              congestion: patch.congestion === undefined ? edge.congestion : clamp(patch.congestion, 1, 5, 1),
            }
          : edge,
      ),
    );
  };

  const resetGraph = () => {
    setEdges(initialEdges);
    setSelectedEdgeId("AC");
    setSelectedVertexId(null);
    setAlgorithmStep(0);
    setRouteUpdate(null);
    previousEdgesRef.current = initialEdges;
    previousPathRef.current = "";
  };

  const enterPresentation = () => {
    document.documentElement.requestFullscreen?.();
    document.body.classList.add("presentation-mode");
  };

  const showAlgorithm = () => {
    setAlgorithmOpen(true);
    setAlgorithmStep(0);
    setPlayingAlgorithm(true);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Interactive Mathematics Exhibition</p>
          <h1>SmartRoute City Optimiser</h1>
        </div>
        <div className="topbar-actions">
          <button className="touch-button secondary" onClick={resetGraph} type="button">
            <RotateCcw size={21} /> Reset
          </button>
          <button className="touch-button secondary" onClick={showAlgorithm} type="button">
            <Play size={21} /> Show Algorithm
          </button>
          <button className="touch-button secondary locked" type="button" aria-pressed="true">
            <Lock size={21} /> Fixed Network
          </button>
          <button className="touch-button primary" onClick={enterPresentation} type="button">
            <Maximize2 size={21} /> Presentation
          </button>
        </div>
      </header>

      <section className="exhibit-grid">
        <section className="map-stage">
          <AnimatePresence>
            {routeUpdate && (
              <motion.div
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="route-toast"
                exit={{ opacity: 0, y: -16, scale: 0.96 }}
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                key={routeUpdate.id}
              >
                <strong>Route Updated</strong>
                <span>
                  {routeUpdate.road}: {formatNumber(routeUpdate.before)} → {formatNumber(routeUpdate.after)} min
                </span>
                <em>{formatPlacePath(routeUpdate.path)}</em>
              </motion.div>
            )}
          </AnimatePresence>

          <GraphCanvas
            algorithmCurrent={currentStep?.current ?? null}
            edges={weighted}
            onSelectEdge={(edgeId) => {
              setSelectedEdgeId(edgeId);
              setSelectedVertexId(null);
            }}
            onSelectVertex={setSelectedVertexId}
            relaxedEdgeIds={relaxedEdgeIds}
            selectedEdgeId={selectedEdge.id}
            selectedVertexId={selectedVertexId}
            shortestEdgeSet={shortestEdgeSet}
            vertices={vertices}
            visitedNodes={visitedNodes}
          />
        </section>

        <aside className="dashboard">
          <section className="hero-card">
            <div className="hero-icon">
              <Route size={30} />
            </div>
            <span>Current Optimal Route</span>
            <motion.strong key={formatPlacePath(result.path)} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }}>
              {formatPlacePath(result.path)}
            </motion.strong>
          </section>

          <section className="metric-grid">
            <Metric icon={<Gauge size={22} />} label="Optimal Route Cost" value={`${formatNumber(result.cost)} min`} />
            <Metric
              icon={<TrafficCone size={22} />}
              label="Alternative Route Cost"
              value={alternativePath ? `${formatNumber(alternativePath.cost)} min` : "No alternative route"}
            />
            <Metric icon={<Activity size={22} />} label="Time Saved" value={timeSaved === null ? "No alternative route" : `${formatNumber(timeSaved)} min`} />
            <Metric icon={<BarChart3 size={22} />} label="Percentage Improvement" value={improvement === null ? "No alternative route" : `${formatNumber(improvement)}%`} />
          </section>

          <section className="formula-card">
            <div>
              <Sigma size={22} />
              <span>Mathematical Model</span>
            </div>
            <p>Cost(Route) = Σ Road Weights</p>
            <p>Weight = Base Time × Congestion Factor</p>
          </section>

          <RoadInspector
            edge={selectedWeightedEdge}
            onSetBaseTime={(value) => updateEdge(selectedEdge.id, { baseTime: value })}
            onSetCongestion={(value) => updateEdge(selectedEdge.id, { congestion: value })}
            selectedBand={selectedBand}
          />

          <AlgorithmPanel
            currentStep={currentStep}
            isOpen={isAlgorithmOpen}
            isPlaying={isPlayingAlgorithm}
            onClose={() => {
              setAlgorithmOpen(false);
              setPlayingAlgorithm(false);
            }}
            onNext={() => setAlgorithmStep((step) => Math.min(result.iterations.length - 1, step + 1))}
            onPrevious={() => setAlgorithmStep((step) => Math.max(0, step - 1))}
            onTogglePlay={() => setPlayingAlgorithm((playing) => !playing)}
            step={algorithmStep}
            totalSteps={result.iterations.length}
            vertices={vertices}
          />
        </aside>
      </section>
    </main>
  );
}

function GraphCanvas({
  algorithmCurrent,
  edges,
  onSelectEdge,
  onSelectVertex,
  relaxedEdgeIds,
  selectedEdgeId,
  selectedVertexId,
  shortestEdgeSet,
  vertices,
  visitedNodes,
}: {
  algorithmCurrent: VertexId | null;
  edges: WeightedEdge[];
  onSelectEdge: (edgeId: string) => void;
  onSelectVertex: (vertexId: VertexId) => void;
  relaxedEdgeIds: Set<string>;
  selectedEdgeId: string;
  selectedVertexId: VertexId | null;
  shortestEdgeSet: Set<string>;
  vertices: Vertex[];
  visitedNodes: Set<VertexId>;
}) {
  return (
    <section className="city-card">
      <div className="map-caption">
        <div>
          <span>Fixed Seven-Stop City Network</span>
          <strong>School to Burger Restaurant: minimum travel time</strong>
        </div>
        <div className="legend">
          {congestionBands.map((band) => (
            <span key={band.label}>
              <i style={{ background: band.color }} />
              {band.label}
            </span>
          ))}
        </div>
      </div>

      <svg aria-label="Fixed city route optimisation map" className="city-map" viewBox="0 0 100 100">
        <defs>
          <filter id="route-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur result="blur" stdDeviation="1.2" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="city-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dbe3ec" strokeWidth="0.22" />
          </pattern>
        </defs>
        <rect fill="#eef4f7" height="100" width="100" />
        <rect fill="url(#city-grid)" height="100" opacity="0.55" width="100" />
        <path d="M6 25 C23 16 35 23 49 13 S76 9 94 18" className="park-line" />
        <path d="M6 94 C24 82 35 96 48 84 S76 70 94 79" className="water-line" />

        {edges.map((edge) => {
          const { from, to } = edgeLine(edge, vertices);
          const band = getCongestionBand(edge.congestion);
          return (
            <g key={`${edge.id}-base`}>
              <line className="road-shadow" x1={from.x} x2={to.x} y1={from.y} y2={to.y} />
              <motion.line
                animate={{ stroke: band.color }}
                className="road"
                strokeLinecap="round"
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
              />
            </g>
          );
        })}

        {edges.map((edge) => {
          const { from, to } = edgeLine(edge, vertices);
          const isShortest = shortestEdgeSet.has(edgeKey(edge.from, edge.to));
          const isSelected = edge.id === selectedEdgeId;
          const isRelaxed = relaxedEdgeIds.has(edge.id);
          return (
            <g key={`${edge.id}-route`}>
              {isSelected && <line className="selected-road" x1={from.x} x2={to.x} y1={from.y} y2={to.y} />}
              {isRelaxed && <line className="relaxed-road" x1={from.x} x2={to.x} y1={from.y} y2={to.y} />}
              {isShortest && (
                <>
                  <motion.line
                    animate={{ opacity: [0.4, 1, 0.72] }}
                    className="optimal-road"
                    filter="url(#route-glow)"
                    initial={{ opacity: 0 }}
                    strokeLinecap="round"
                    transition={{ duration: 0.7 }}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                  <line className="route-pulse" x1={from.x} x2={to.x} y1={from.y} y2={to.y} />
                </>
              )}
            </g>
          );
        })}

        {edges.map((edge) => {
          const midpoint = edgeMidpoint(edge, vertices);
          const { from, to } = edgeLine(edge, vertices);
          const isSelected = edge.id === selectedEdgeId;
          return (
            <g
              className="road-hit-target"
              key={`${edge.id}-label`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
            >
              <line
                opacity="0"
                stroke="transparent"
                strokeLinecap="round"
                strokeWidth="9"
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
              />
              <rect
                className={isSelected ? "time-label selected" : "time-label"}
                height="7.4"
                rx="2.4"
                width="15"
                x={midpoint.x - 7.5}
                y={midpoint.y - 3.7}
              />
              <text className="time-text" textAnchor="middle" x={midpoint.x} y={midpoint.y + 1.35}>
                {formatNumber(edge.weight)} min
              </text>
            </g>
          );
        })}

        {vertices.map((vertex) => {
          const isTerminal = vertex.id === sourceVertex || vertex.id === targetVertex;
          const isCurrent = algorithmCurrent === vertex.id;
          const isVisited = visitedNodes.has(vertex.id);
          const isSelected = selectedVertexId === vertex.id;
          return (
            <g
              className="intersection fixed"
              key={vertex.id}
              onClick={(event) => {
                event.stopPropagation();
                onSelectVertex(vertex.id);
              }}
            >
              <circle
                className={isTerminal ? "intersection-ring terminal" : "intersection-ring"}
                cx={vertex.x}
                cy={vertex.y}
                r={isCurrent ? "7" : isVisited || isSelected ? "6.5" : "6"}
              />
              <circle className="intersection-core" cx={vertex.x} cy={vertex.y} r="4.35" />
              <text className="intersection-icon" textAnchor="middle" x={vertex.x} y={vertex.y - 0.85}>
                {vertex.icon}
              </text>
              <text className="intersection-label" textAnchor="middle" x={vertex.x} y={vertex.y + 8.5}>
                {vertex.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function RoadInspector({
  edge,
  onSetBaseTime,
  onSetCongestion,
  selectedBand,
}: {
  edge: WeightedEdge;
  onSetBaseTime: (value: number) => void;
  onSetCongestion: (value: number) => void;
  selectedBand: { label: string; color: string; max: number };
}) {
  return (
    <section className="road-card">
      <div className="road-card-head">
        <div>
          <span>Selected Road</span>
          <strong>{roadName(edge)}</strong>
        </div>
      </div>
      <div className="road-stats">
        <MiniStat label="Base Travel Time" value={`${formatNumber(edge.baseTime)} min`} />
        <MiniStat label="Congestion Factor" value={`${formatNumber(edge.congestion)}x`} />
        <MiniStat label="Current Weight" value={`${formatNumber(edge.weight)} min`} />
      </div>
      <div className="congestion-status" style={{ "--road-color": selectedBand.color } as React.CSSProperties}>
        <span>{selectedBand.label}</span>
        <strong>Congestion Level</strong>
      </div>

      <VariableControl
        label="Base Travel Time"
        max={30}
        min={1}
        onChange={onSetBaseTime}
        step={1}
        suffix="min"
        value={edge.baseTime}
      />
      <VariableControl
        label="Congestion Factor"
        max={5}
        min={1}
        onChange={onSetCongestion}
        step={0.1}
        suffix="x"
        value={edge.congestion}
      />

      <div className="calculation-card">
        <span>Current Calculation</span>
        <strong>
          {formatNumber(edge.baseTime)} × {formatNumber(edge.congestion)} = {formatNumber(edge.weight)} min
        </strong>
        <p>Weight = Base Time × Congestion Factor</p>
      </div>
    </section>
  );
}

function VariableControl({
  label,
  max,
  min,
  onChange,
  step,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix: string;
  value: number;
}) {
  return (
    <div className="variable-control">
      <div className="variable-head">
        <span>{label}</span>
        <strong>
          {formatNumber(value)} {suffix}
        </strong>
      </div>
      <div className="control-row">
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(value - step)} type="button">
          <Minus size={26} />
        </button>
        <input
          aria-label={label}
          className="large-slider"
          max={max}
          min={min}
          step={step}
          type="range"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button aria-label={`Increase ${label}`} onClick={() => onChange(value + step)} type="button">
          <Plus size={26} />
        </button>
      </div>
    </div>
  );
}

function AlgorithmPanel({
  currentStep,
  isOpen,
  isPlaying,
  onClose,
  onNext,
  onPrevious,
  onTogglePlay,
  step,
  totalSteps,
  vertices,
}: {
  currentStep: ReturnType<typeof dijkstra>["iterations"][number] | undefined;
  isOpen: boolean;
  isPlaying: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onTogglePlay: () => void;
  step: number;
  totalSteps: number;
  vertices: Vertex[];
}) {
  if (!isOpen || !currentStep) return null;

  const changedRelaxation = currentStep.relaxations.find((relaxation) => relaxation.changed);

  return (
    <motion.section animate={{ opacity: 1, y: 0 }} className="algorithm-card" initial={{ opacity: 0, y: 14 }}>
      <div className="algorithm-head">
        <div>
          <span>Dijkstra Solving</span>
          <strong>
            Iteration {step + 1} of {totalSteps}
          </strong>
        </div>
        <button onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="algorithm-focus">
        <MiniStat label="Current Node" value={currentStep.current ?? "—"} />
        <MiniStat label="Visited Nodes" value={currentStep.visited.join(", ")} />
        <MiniStat label="Relaxed Edge" value={changedRelaxation?.edge ?? currentStep.relaxations[0]?.edge ?? "None"} />
      </div>
      <div className="distance-strip">
        {vertices.map((vertex) => (
          <span key={vertex.id}>
            d({vertex.id}) <strong>{formatNumber(currentStep.distancesAfter[vertex.id])}</strong>
          </span>
        ))}
      </div>
      <div className="relaxation-line">
        {changedRelaxation ? (
          <>
            <ArrowRight size={18} />
            d({changedRelaxation.to}) = {formatNumber(changedRelaxation.candidate)}
          </>
        ) : (
          "No distance improved this step"
        )}
      </div>
      <div className="algorithm-controls">
        <button onClick={onPrevious} type="button">
          <ChevronLeft size={24} />
        </button>
        <button className="play-button" onClick={onTogglePlay} type="button">
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={onNext} type="button">
          <ChevronRight size={24} />
        </button>
      </div>
    </motion.section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <motion.div animate={{ opacity: 1 }} className="metric" initial={{ opacity: 0.5 }} key={`${label}-${value}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
