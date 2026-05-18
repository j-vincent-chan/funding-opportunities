"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type NetworkNode = { id: string; label: string };
export type NetworkEdge = { a: string; b: string; weight: number };

function truncate(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function computeDegrees(nodes: NetworkNode[], edges: NetworkEdge[]): Map<string, number> {
  const m = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    m.set(e.a, (m.get(e.a) ?? 0) + 1);
    m.set(e.b, (m.get(e.b) ?? 0) + 1);
  }
  return m;
}

function degreeToColor(deg: number): string {
  // Higher degree -> warmer / darker.
  const t = Math.min(1, deg / 14);
  const hue = 215 - t * 160; // ~blue to ~orange/red
  const sat = 78;
  const light = 52 - t * 14;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function forceLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const pos = new Map(
    nodes.map((n) => [
      n.id,
      {
        x: width / 2 + (Math.random() - 0.5) * width * 0.55,
        y: height / 2 + (Math.random() - 0.5) * height * 0.55,
      },
    ])
  );
  if (nodes.length === 0) return pos;
  const k = Math.sqrt((width * height) / Math.max(1, nodes.length));

  for (let iter = 0; iter < 90; iter += 1) {
    const disp = new Map(nodes.map((n) => [n.id, { dx: 0, dy: 0 }]));

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const idA = nodes[i].id;
        const idB = nodes[j].id;
        const pa = pos.get(idA);
        const pb = pos.get(idB);
        if (!pa || !pb) continue;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const rep = (k * k) / dist;
        const rx = (dx / dist) * rep;
        const ry = (dy / dist) * rep;
        disp.get(idA)!.dx += rx;
        disp.get(idA)!.dy += ry;
        disp.get(idB)!.dx -= rx;
        disp.get(idB)!.dy -= ry;
      }
    }

    for (const e of edges) {
      const pa = pos.get(e.a);
      const pb = pos.get(e.b);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const att = (dist / k) * (0.04 + Math.min(0.06, e.weight / 50));
      const fx = (dx / dist) * att;
      const fy = (dy / dist) * att;
      disp.get(e.a)!.dx += fx;
      disp.get(e.a)!.dy += fy;
      disp.get(e.b)!.dx -= fx;
      disp.get(e.b)!.dy -= fy;
    }

    const temp = 1 - iter / 90;
    const step = 0.12 * temp;
    for (const n of nodes) {
      const p = pos.get(n.id);
      const d = disp.get(n.id);
      if (!p || !d) continue;
      p.x += d.dx * step;
      p.y += d.dy * step;
      p.x = Math.max(28, Math.min(width - 28, p.x));
      p.y = Math.max(28, Math.min(height - 28, p.y));
    }
  }

  return pos;
}

export function CommunityNetworkGraph({
  title,
  description,
  nodes,
  edges,
  sourceNote,
  emptyMessage,
  graphCommonsGraphUrl,
}: {
  title: string;
  description?: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** e.g. co-authorship from PubMed */
  sourceNote: string;
  emptyMessage: string;
  /** Optional: Graph Commons graph URL to embed (if the host permits framing). */
  graphCommonsGraphUrl?: string | null;
}) {
  const width = 1200;
  const height = 680;
  const frameUrl = graphCommonsGraphUrl?.trim() || null;

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    setPositions(forceLayout(nodes, edges, width, height));
    setView({ scale: 1, tx: 0, ty: 0 });
  }, [nodes, edges]);

  const degrees = useMemo(() => computeDegrees(nodes, edges), [nodes, edges]);
  const maxDegree = useMemo(
    () => Math.max(1, ...Array.from(degrees.values())),
    [degrees]
  );

  const resetView = useCallback(() => {
    setView({ scale: 1, tx: 0, ty: 0 });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.09;
    setView((v) => ({
      ...v,
      scale: Math.min(3, Math.max(0.35, v.scale * factor)),
    }));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: view.tx,
      startTy: view.ty,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [view.tx, view.ty]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setView((v) => ({
      ...v,
      tx: d.startTx + (e.clientX - d.startX),
      ty: d.startTy + (e.clientY - d.startY),
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const hasGraph = nodes.length > 0 && edges.length > 0;

  if (!hasGraph && !frameUrl) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
        <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
      <p className="mt-1 text-[11px] text-slate-500">{sourceNote}</p>
      {frameUrl ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Embedded Graph Commons explorer (interactive if embedding is allowed).
            </p>
            <a
              href={frameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--accent)] underline"
            >
              Open on Graph Commons →
            </a>
          </div>
          <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <iframe
              title="Graph Commons network"
              src={frameUrl}
              className="h-[min(75vh,760px)] w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Configure via{" "}
            <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_GRAPHCOMMON_GRAPH_URL</code> (or{" "}
            <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_GRAPHCOMMONS_GRAPH_URL</code>).
          </p>
        </div>
      ) : null}

      {hasGraph ? (
        <div className={frameUrl ? "mt-6 border-t border-slate-200 pt-6" : "mt-4"}>
          {frameUrl ? (
            <p className="mb-2 text-xs font-medium text-slate-700">
              Live co-authorship sample (from your Supabase cache)
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>
              <span className="font-medium text-slate-800">Explore:</span> drag to pan · wheel to
              zoom · click node to pin tooltip
            </span>
            <span className="text-slate-400">|</span>
            <span>
              Node color by degree; edge width by shared evidence (max degree in view: {maxDegree})
            </span>
            <button
              type="button"
              onClick={resetView}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset view
            </button>
          </div>

          <div className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {!positions ? (
              <div
                className="flex h-[min(72vh,720px)] items-center justify-center text-sm text-slate-500"
                aria-hidden
              >
                Laying out graph…
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-[min(72vh,720px)] w-full cursor-grab touch-none active:cursor-grabbing"
                role="img"
                aria-label="Collaboration network map"
                onWheel={onWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <defs>
                  <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#475569" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <rect width={width} height={height} fill="#f8fafc" rx={8} />
                <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
                  {edges.map((e, i) => {
                    const pa = positions.get(e.a);
                    const pb = positions.get(e.b);
                    if (!pa || !pb) return null;
                    const w = Math.max(0.6, Math.min(6, e.weight / 6));
                    const isHot = hoverId && (e.a === hoverId || e.b === hoverId);
                    return (
                      <line
                        key={`${e.a}-${e.b}-${i}`}
                        x1={pa.x}
                        y1={pa.y}
                        x2={pb.x}
                        y2={pb.y}
                        stroke="url(#edgeGrad)"
                        strokeWidth={w}
                        strokeOpacity={isHot ? 1 : 0.75}
                      />
                    );
                  })}

                  {nodes.map((n) => {
                    const p = positions.get(n.id);
                    if (!p) return null;
                    const deg = degrees.get(n.id) ?? 0;
                    const r = 7 + Math.min(12, deg * 0.9);
                    const isHover = hoverId === n.id;
                    return (
                      <g
                        key={n.id}
                        onPointerEnter={() => setHoverId(n.id)}
                        onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isHover ? r + 3 : r}
                          fill={degreeToColor(deg)}
                          fillOpacity={0.95}
                          stroke={isHover ? "#0f172a" : "#1e293b"}
                          strokeWidth={isHover ? 2.5 : 1.2}
                        />
                        <title>{`${n.label} — degree ${deg}`}</title>
                        {isHover ? (
                          <g>
                            <rect
                              x={p.x + 10}
                              y={p.y - 22}
                              width={Math.min(360, 10 + n.label.length * 7)}
                              height={28}
                              rx={6}
                              fill="#0f172a"
                              opacity={0.92}
                            />
                            <text x={p.x + 16} y={p.y - 4} fontSize={12} fill="#f8fafc">
                              {n.label}
                            </text>
                          </g>
                        ) : null}
                        <text
                          x={p.x}
                          y={p.y + r + 16}
                          textAnchor="middle"
                          fontSize={11}
                          fill="#0f172a"
                          className="pointer-events-none select-none"
                          style={{ textShadow: "0 0 6px #fff, 0 0 10px #fff" }}
                        >
                          {truncate(n.label, 22)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">
        Nodes = investigators with at least one edge in this sample. Edge thickness scales with
        shared evidence (e.g. co-authored publications).
      </p>
    </div>
  );
}
