"use client";

import React, { useEffect, useMemo, useState } from "react";

type AgentNode = {
  id: string;
  name: string;
  path: string;
  methods: ("GET" | "POST" | "DELETE")[];
  description?: string;
  group: "orchestration" | "analysis" | "generation" | "media" | "progress";
  env?: string[];
};

type AgentEdge = {
  from: string;
  to: string;
  label?: string;
  optional?: boolean;
};

type AgentGraph = {
  nodes: AgentNode[];
  edges: AgentEdge[];
};

const GROUP_COLOR: Record<AgentNode["group"], string> = {
  orchestration: "#8b5cf6",
  analysis: "#10b981",
  generation: "#60a5fa",
  media: "#f59e0b",
  progress: "#ef4444",
};

export default function AgentsGraphPage() {
  const [graph, setGraph] = useState<AgentGraph>({ nodes: [], edges: [] });
  const [error, setError] = useState<string | null>(null);
  const [inkeepUrl, setInkeepUrl] = useState<string | null>(
    process.env.NEXT_PUBLIC_INKEEP_BUILDER_URL || null
  );
  const [session, setSession] = useState<string>("default");
  const [activeIds, setActiveIds] = useState<Record<string, number>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/agents/graph")
      .then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(t))))
      .then((j) => mounted && setGraph(j))
      .catch((e) => mounted && setError(String(e)));
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to SSE progress to animate flow
  useEffect(() => {
    const url = `/api/progress?session=${encodeURIComponent(session)}`;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const agentId: string | undefined = data?.agentId;
        if (agentId) {
          setActiveIds((prev) => ({ ...prev, [agentId]: Date.now() }));
        } else {
          const text: string = data?.text || "";
          const matched = matchAgentByMessage(graph, text);
          if (matched) setActiveIds((prev) => ({ ...prev, [matched]: Date.now() }));
        }
      } catch {}
    };
    es.onerror = () => {
      try { es.close(); } catch {}
    };
    return () => {
      try { es.close(); } catch {}
    };
  }, [session, graph]);

  // Expire highlights
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setActiveIds((prev) => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) if (now - v < 4000) next[k] = v;
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const layout = useMemo(() => computeLayout(graph), [graph]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0d12] text-white">
      <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Agent Graph</span>
            <span className="text-xs text-white/60">Visualizing API-based agents</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60">Session</label>
            <input
              className="border border-white/10 bg-transparent rounded px-2 py-1 text-xs w-[160px]"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="default"
            />
            <a className="text-xs underline text-blue-400" href="/">Back to Studio</a>
          </div>
        </div>
      </header>
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_380px]">
        <section className="relative">
          {error ? (
            <div className="text-red-400 text-sm p-4">{error}</div>
          ) : (
            <GraphCanvas
              graph={graph}
              layout={layout}
              activeIds={activeIds}
              hoverId={hoverId}
              setHoverId={setHoverId}
            />
          )}
          <Legend />
        </section>
        <section className="border-l border-white/10 p-4 overflow-auto bg-black/20">
          <h3 className="font-semibold mb-2">Nodes</h3>
          <ul className="space-y-2">
            {graph.nodes.map((n) => (
              <li
                key={n.id}
                className={`text-sm p-2 rounded hover:bg-white/5 cursor-pointer ${hoverId === n.id ? "bg-white/10" : ""}`}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
              >
                <span
                  className="inline-block w-2 h-2 mr-2 rounded-full align-middle"
                  style={{ backgroundColor: GROUP_COLOR[n.group] }}
                />
                <span className="font-medium">{n.name}</span>
                <span className="ml-2 text-white/60">{n.path}</span>
                {n.env?.length ? (
                  <div className="text-[11px] text-white/50 mt-1">
                    env: {n.env.join(", ")}
                  </div>
                ) : null}
                {n.description ? (
                  <div className="text-xs mt-1 text-white/70">{n.description}</div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <label className="block text-xs text-white/60 mb-1">Inkeep Builder URL</label>
            <input
              className="border border-white/10 bg-transparent rounded px-2 py-1 text-xs w-full"
              placeholder="https://your-inkeep-builder"
              value={inkeepUrl || ""}
              onChange={(e) => setInkeepUrl(e.target.value || null)}
            />
            {inkeepUrl ? (
              <iframe
                key={inkeepUrl}
                src={inkeepUrl}
                className="w-full h-[420px] mt-3 rounded"
                style={{ border: 0 }}
                allow="clipboard-read *; clipboard-write *;"
              />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function GraphCanvas({
  graph,
  layout,
  activeIds,
  hoverId,
  setHoverId,
}: {
  graph: AgentGraph;
  layout: Layout;
  activeIds: Record<string, number>;
  hoverId: string | null;
  setHoverId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { positionedNodes, edges } = layout;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panning, setPanning] = useState<null | { x: number; y: number }>(null);

  const width = Math.max(...positionedNodes.map((n) => n.x)) + 320;
  const height = Math.max(...positionedNodes.map((n) => n.y)) + 220;

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const next = Math.min(2, Math.max(0.4, zoom * factor));
    setZoom(next);
  }
  function onMouseDown(e: React.MouseEvent) {
    setPanning({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!panning) return;
    setOffset({ x: e.clientX - panning.x, y: e.clientY - panning.y });
  }
  function onMouseUp() {
    setPanning(null);
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#1c2433_0%,#0b0d12_60%)]"
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        width={width}
        height={height}
        className="rounded shadow-xl border border-white/10"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        onMouseDown={onMouseDown}
      >
        {edges.map((e, i) => (
          <Edge key={i} edge={e} dim={hoverId && hoverId !== e.from && hoverId !== e.to} active={isEdgeActive(e, activeIds)} />
        ))}
        {positionedNodes.map((n) => (
          <Node
            key={n.id}
            node={n}
            active={Boolean(activeIds[n.id])}
            dim={Boolean(hoverId && hoverId !== n.id)}
            onEnter={() => setHoverId(n.id)}
            onLeave={() => setHoverId((h) => (h === n.id ? null : h))}
          />
        ))}
      </svg>
      <div className="absolute top-3 right-3 bg-black/40 border border-white/10 rounded backdrop-blur px-2 py-1 text-xs flex items-center gap-2">
        <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={() => setZoom((z) => Math.min(2, z * 1.1))}>+</button>
        <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={() => setZoom((z) => Math.max(0.4, z * 0.9))}>-</button>
        <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>Reset</button>
      </div>
    </div>
  );
}

type PositionedNode = AgentNode & { x: number; y: number };
type PositionedEdge = AgentEdge & { x1: number; y1: number; x2: number; y2: number };
type Layout = { positionedNodes: PositionedNode[]; edges: PositionedEdge[] };

function computeLayout(graph: AgentGraph): Layout {
  // Simple vertical swimlanes by group, ordered lanes: orchestration -> analysis -> generation -> media -> progress
  const laneOrder: AgentNode["group"][] = [
    "orchestration",
    "analysis",
    "generation",
    "media",
    "progress",
  ];
  const laneX: Record<string, number> = Object.fromEntries(
    laneOrder.map((g, i) => [g, 120 + i * 260])
  );
  const buckets: Record<string, AgentNode[]> = {} as any;
  for (const n of graph.nodes) {
    const g = n.group;
    buckets[g] ||= [];
    buckets[g].push(n);
  }
  for (const g of Object.keys(buckets)) {
    buckets[g].sort((a, b) => a.name.localeCompare(b.name));
  }
  const positionedNodes: PositionedNode[] = [];
  for (const g of laneOrder) {
    const list = buckets[g] || [];
    list.forEach((n, idx) => {
      const x = laneX[g];
      const y = 120 + idx * 160;
      positionedNodes.push({ ...n, x, y });
    });
  }
  function find(id: string): PositionedNode | undefined {
    return positionedNodes.find((n) => n.id === id);
  }
  const edges: PositionedEdge[] = [];
  for (const e of graph.edges) {
    const a = find(e.from);
    const b = find(e.to);
    if (!a || !b) continue;
    edges.push({ ...e, x1: a.x + 200, y1: a.y + 48, x2: b.x, y2: b.y + 48 });
  }
  return { positionedNodes, edges };
}

function isEdgeActive(e: PositionedEdge, active: Record<string, number>): boolean {
  return Boolean(active[e.from] || active[e.to]);
}

function matchAgentByMessage(graph: AgentGraph, message: string): string | null {
  const m = message.toLowerCase();
  const pairs: [string, string[]][] = graph.nodes.map((n) => [n.id, [n.name, n.path, n.id]]);
  for (const [id, keys] of pairs) {
    if (keys.some((k) => (k || "").toLowerCase().includes("voice run")) && /voice/.test(m)) return "voice.run";
    if (keys.some((k) => (k || "").toLowerCase().includes("vision")) && /analyz|image/i.test(m)) return "vision.analyze";
    if (keys.some((k) => (k || "").toLowerCase().includes("cultural")) && /cultural|culture/i.test(m)) return "cultural.intelligence";
    if (keys.some((k) => (k || "").toLowerCase().includes("imagen")) && /image|imagen/i.test(m)) return "imagen.generate";
    if (keys.some((k) => (k || "").toLowerCase().includes("veo")) && /video|veo|operation|download/i.test(m)) return id;
  }
  return null;
}

function Node({ node, active, dim, onEnter, onLeave }: { node: PositionedNode; active?: boolean; dim?: boolean; onEnter?: () => void; onLeave?: () => void; }) {
  const color = GROUP_COLOR[node.group];
  const strokeWidth = active ? 3 : 1.5;
  const shadow = active ? 0.35 : 0.18;
  const opacity = dim ? 0.5 : 1;
  return (
    <g transform={`translate(${node.x}, ${node.y})`} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ cursor: "pointer", opacity }}>
      <rect width="200" height="96" rx="12" ry="12" fill={color} opacity={0.12} stroke={color} strokeWidth={strokeWidth} />
      <text x={12} y={24} fontSize={13} fontWeight={700} fill="#e5e7eb" style={{ textShadow: `0 1px ${shadow}em rgba(0,0,0,.6)` }}>
        {node.name}
      </text>
      <text x={12} y={44} fontSize={11} fill="#cbd5e1">
        {node.path}
      </text>
      <text x={12} y={62} fontSize={11} fill="#94a3b8">
        {node.methods.join("/")}
      </text>
      {active ? (
        <circle cx={188} cy={12} r={5} fill="#22c55e" />
      ) : null}
    </g>
  );
}

function Edge({ edge, dim, active }: { edge: PositionedEdge; dim?: boolean; active?: boolean }) {
  const base = edge.optional ? "#9CA3AF" : "#93c5fd";
  const strong = edge.optional ? "#6b7280" : "#60a5fa";
  const stroke = active ? strong : base;
  const markerId = edge.optional ? "arrow-gray" : "arrow-blue";
  const opacity = dim ? 0.4 : active ? 1 : 0.8;
  return (
    <g opacity={opacity}>
      <defs>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
        <marker id="arrow-gray" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
        </marker>
      </defs>
      <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke={stroke} strokeWidth={active ? 2.2 : 1.6} markerEnd={`url(#${markerId})`} />
      {edge.label ? (
        <text x={(edge.x1 + edge.x2) / 2} y={(edge.y1 + edge.y2) / 2 - 6} fontSize={10} textAnchor="middle" fill="#93c5fd">
          {edge.label}
        </text>
      ) : null}
    </g>
  );
}

function Legend() {
  const items = [
    { label: "Orchestration", key: "orchestration" as const },
    { label: "Analysis", key: "analysis" as const },
    { label: "Generation", key: "generation" as const },
    { label: "Media", key: "media" as const },
    { label: "Progress", key: "progress" as const },
  ];
  return (
    <div className="absolute bottom-3 left-3 bg-black/40 border border-white/10 rounded backdrop-blur px-3 py-2 text-xs flex items-center gap-3">
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded" style={{ backgroundColor: GROUP_COLOR[it.key] }} />
          <span className="text-white/80">{it.label}</span>
        </div>
      ))}
    </div>
  );
}


