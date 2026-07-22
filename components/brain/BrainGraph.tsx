"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphModel, RenderNode } from "@/lib/brain/graph";

// Dependency-free interactive SVG graph (SPEC-BRAIN.md Phase 6). Pan (drag),
// zoom (wheel + buttons), hover-highlight the 1-hop neighbourhood, click to
// select, and pulse the nodes a citation deep-linked to (?focus=). Foundation
// nodes are muted; user content is teal. A list-view fallback lives in the
// parent for accessibility/mobile.

const COLORS: Record<RenderNode["kind"], string> = {
  pillar: "var(--border-strong)",
  topic: "var(--text-muted)",
  general: "var(--text-muted)",
  "user-node": "var(--accent)",
  source: "var(--accent-line)",
};

type Props = {
  model: GraphModel;
  focusIds?: string[];
  selectedId?: string | null;
  onSelect: (nodeId: string | null) => void;
};

type Box = { x: number; y: number; w: number; h: number };

function contentBox(nodes: RenderNode[]): Box {
  if (nodes.length === 0) return { x: -500, y: -500, w: 1000, h: 1000 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const pad = 120;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    x: minX,
    y: minY,
    w: Math.max(...xs) + pad - minX,
    h: Math.max(...ys) + pad - minY,
  };
}

export default function BrainGraph({ model, focusIds = [], selectedId, onSelect }: Props) {
  const initial = useMemo(() => contentBox(model.nodes), [model.nodes]);
  const [box, setBox] = useState<Box>(initial);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Re-fit when the graph's node set changes (upload/delete/erase).
  useEffect(() => setBox(contentBox(model.nodes)), [model.nodes]);

  const focus = useMemo(() => new Set(focusIds), [focusIds]);
  const nodeById = useMemo(() => new Map(model.nodes.map((n) => [n.id, n])), [model.nodes]);

  // Neighbourhood of the hovered/selected node (for dimming the rest).
  const activeId = hoverId ?? selectedId ?? null;
  const neighbourhood = useMemo(() => {
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    for (const e of model.edges) {
      if (e.from === activeId) set.add(e.to);
      if (e.to === activeId) set.add(e.from);
    }
    return set;
  }, [activeId, model.edges]);

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setBox((b) => {
      const nw = Math.max(200, Math.min(6000, b.w * factor));
      const nh = nw * (b.h / b.w);
      const ax = cx ?? b.x + b.w / 2;
      const ay = cy ?? b.y + b.h / 2;
      // keep the anchor point stationary
      return {
        w: nw,
        h: nh,
        x: ax - ((ax - b.x) * nw) / b.w,
        y: ay - ((ay - b.y) * nh) / b.h,
      };
    });
  };

  const clientToUser = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: box.x + ((clientX - rect.left) / rect.width) * box.w,
      y: box.y + ((clientY - rect.top) / rect.height) * box.h,
    };
  };

  return (
    <div className="relative w-full h-full">
      {/* Zoom / fit controls — 44px tap targets */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        {[
          { label: "+", fn: () => zoom(0.8), aria: "Zoom in" },
          { label: "−", fn: () => zoom(1.25), aria: "Zoom out" },
          { label: "⤢", fn: () => setBox(contentBox(model.nodes)), aria: "Fit to view" },
        ].map((c) => (
          <button
            key={c.aria}
            type="button"
            aria-label={c.aria}
            onClick={c.fn}
            className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ width: 44, height: 44 }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        className="w-full h-full touch-none select-none"
        style={{ cursor: drag.current ? "grabbing" : "grab", background: "var(--surface-1)" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, ox: box.x, oy: box.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const dx = ((e.clientX - drag.current.px) / rect.width) * box.w;
          const dy = ((e.clientY - drag.current.py) / rect.height) * box.h;
          setBox((b) => ({ ...b, x: drag.current!.ox - dx, y: drag.current!.oy - dy }));
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => {
          const p = clientToUser(e.clientX, e.clientY);
          zoom(e.deltaY > 0 ? 1.1 : 0.9, p.x, p.y);
        }}
        onClick={(e) => {
          if (e.target === svgRef.current) onSelect(null);
        }}
      >
        {/* Edges */}
        {model.edges.map((edge, i) => {
          const a = nodeById.get(edge.from);
          const b = nodeById.get(edge.to);
          if (!a || !b) return null;
          const dim = neighbourhood && !(neighbourhood.has(edge.from) && neighbourhood.has(edge.to));
          const stroke =
            edge.kind === "weave" ? "var(--accent-line)" : "var(--border)";
          return (
            <line
              key={`e${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={edge.kind === "tree" ? 1.5 : 1}
              strokeDasharray={edge.kind === "related" ? "4 4" : undefined}
              opacity={dim ? 0.08 : edge.kind === "weave" ? 0.6 : 0.35}
            />
          );
        })}

        {/* Nodes */}
        {model.nodes.map((n) => {
          const dim = neighbourhood && !neighbourhood.has(n.id);
          const isFocus = focus.has(n.id) || focus.has(n.id.replace(/^source:/, ""));
          const isSelected = n.id === selectedId;
          return (
            <g
              key={n.id}
              opacity={dim ? 0.25 : 1}
              style={{ cursor: "pointer" }}
              onPointerEnter={() => setHoverId(n.id)}
              onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
              }}
            >
              {/* invisible >=44px hit target */}
              <circle cx={n.x} cy={n.y} r={Math.max(n.r + 14, 22)} fill="transparent" />
              {isFocus && (
                <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke="var(--accent)" strokeWidth={2}>
                  <animate attributeName="r" values={`${n.r + 4};${n.r + 16};${n.r + 4}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.kind === "user-node" || n.kind === "source" ? COLORS[n.kind] : "var(--surface-2)"}
                stroke={isSelected ? "var(--accent-on)" : COLORS[n.kind]}
                strokeWidth={isSelected ? 3 : n.kind === "user-node" ? 2 : 1.5}
              />
              {(n.kind === "pillar" || activeId === n.id || isSelected || isFocus) && (
                <text
                  x={n.x}
                  y={n.y - n.r - 6}
                  textAnchor="middle"
                  fontSize={n.kind === "pillar" ? 15 : 12}
                  fill="var(--text-primary)"
                  style={{ pointerEvents: "none", fontWeight: n.kind === "pillar" ? 600 : 400 }}
                >
                  {n.label.length > 34 ? n.label.slice(0, 33) + "…" : n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)] bg-[var(--surface-1)] rounded-lg px-2 py-1 border border-[var(--border)]">
        <span><span style={{ color: "var(--text-muted)" }}>●</span> topics</span>
        <span><span style={{ color: "var(--accent)" }}>●</span> your topics</span>
        <span><span style={{ color: "var(--accent-line)" }}>●</span> your sources</span>
      </div>
    </div>
  );
}
