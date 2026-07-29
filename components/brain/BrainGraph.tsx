"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { GraphModel, RenderNode } from "@/lib/brain/graph";

// Obsidian-grade graph (SPEC-VAULT.md V2). Canvas renderer driven by a d3-force
// simulation seeded from composeGraphModel's deterministic positions. Smooth
// zoom-to-cursor (native wheel listener, {passive:false} — no page-scroll jank),
// pinch, node drag (fx/fy + reheat), pan, DPR-crisp zoom-fading labels,
// neighbourhood highlight, ?focus= pulse, fit/± controls, a Ctrl-K
// quick-switcher, and filter chips. The list-view a11y fallback lives in the
// parent. Nothing here reads/writes the network.

type SimNode = SimulationNodeDatum & RenderNode;
type SimLink = SimulationLinkDatum<SimNode> & { kind: string };

type Props = {
  model: GraphModel;
  focusIds?: string[];
  selectedId?: string | null;
  onSelect: (nodeId: string | null) => void;
};

type Filter = "all" | "topics" | "files";
type Transform = { k: number; tx: number; ty: number };

type Palette = {
  bg: string;
  border: string;
  borderStrong: string;
  surface2: string;
  textMuted: string;
  textPrimary: string;
  textHead: string;
  accent: string;
  accentLine: string;
  accentOn: string;
};

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--surface-1", "#1A1A1F"),
    border: v("--border", "#3A3A44"),
    borderStrong: v("--border-strong", "#55555F"),
    surface2: v("--surface-2", "#24242B"),
    textMuted: v("--text-muted", "#9A9AA5"),
    textPrimary: v("--text-primary", "#D4D4DA"),
    textHead: v("--text-head", "#F0EEE8"),
    accent: v("--accent", "#5FAE9E"),
    accentLine: v("--accent-line", "#4E9E8C"),
    accentOn: v("--accent-on", "#EAF3F0"),
  };
}

function passesFilter(kind: RenderNode["kind"], filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "topics") return kind !== "source";
  return kind === "source" || kind === "user-node"; // "files"
}

/** Base world radius per node: connected hubs (higher degree) read larger. */
function worldRadius(n: RenderNode): number {
  const base = n.kind === "pillar" ? 20 : n.kind === "source" ? 8 : 12;
  return base + Math.min(8, Math.sqrt(n.degree ?? 0) * 2.2);
}

export default function BrainGraph({ model, focusIds = [], selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const paletteRef = useRef<Palette | null>(null);

  const cur = useRef<Transform>({ k: 1, tx: 0, ty: 0 });
  const target = useRef<Transform>({ k: 1, tx: 0, ty: 0 });
  const size = useRef<{ w: number; h: number; dpr: number }>({ w: 1, h: 1, dpr: 1 });

  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const drawRef = useRef<() => void>(() => {});
  const hoverRef = useRef<string | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragNode = useRef<SimNode | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const pinchDist = useRef<number | null>(null);
  const movedRef = useRef(false);

  const [filter, setFilter] = useState<Filter>("all");
  const [qsOpen, setQsOpen] = useState(false);
  const [qsQuery, setQsQuery] = useState("");

  const selectedRef = useRef<string | null>(selectedId ?? null);
  const focusRef = useRef<Set<string>>(new Set());
  const filterRef = useRef<Filter>("all");
  useEffect(() => {
    selectedRef.current = selectedId ?? null;
    kick();
  }, [selectedId]);
  useEffect(() => {
    focusRef.current = new Set(focusIds);
    kick();
  }, [focusIds]);
  useEffect(() => {
    filterRef.current = filter;
    kick();
  }, [filter]);

  const nodeById = useMemo(() => new Map(model.nodes.map((n) => [n.id, n])), [model.nodes]);

  // ── World→screen projection ──
  const project = (wx: number, wy: number): [number, number] => {
    const { k, tx, ty } = cur.current;
    return [wx * k + tx, wy * k + ty];
  };
  const unproject = (sx: number, sy: number): [number, number] => {
    const { k, tx, ty } = cur.current;
    return [(sx - tx) / k, (sy - ty) / k];
  };

  const screenPos = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const hitTest = (sx: number, sy: number): SimNode | null => {
    const { k } = cur.current;
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (const n of nodesRef.current) {
      if (!passesFilter(n.kind, filterRef.current)) continue;
      const [px, py] = project(n.x ?? 0, n.y ?? 0);
      const rHit = Math.max(worldRadius(n) * k, 10) + 12;
      const d = Math.hypot(px - sx, py - sy);
      if (d <= rHit && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  // ── Animation driver: lerp transform toward target, tick sim while warm ──
  const kick = useCallback(() => {
    drawRef.current(); // paint immediately (also covers a throttled/paused rAF)
    if (runningRef.current) return;
    runningRef.current = true;
    const step = () => {
      const sim = simRef.current;
      const c = cur.current;
      const t = target.current;
      c.k += (t.k - c.k) * 0.22;
      c.tx += (t.tx - c.tx) * 0.22;
      c.ty += (t.ty - c.ty) * 0.22;
      const settledView =
        Math.abs(t.k - c.k) < 0.001 && Math.abs(t.tx - c.tx) < 0.3 && Math.abs(t.ty - c.ty) < 0.3;
      if (settledView) {
        c.k = t.k;
        c.tx = t.tx;
        c.ty = t.ty;
      }
      let simWarm = false;
      if (sim) {
        const a = sim.alpha();
        if (a > 0.004 || dragNode.current) {
          sim.tick();
          simWarm = true;
        }
      }
      drawRef.current();
      if (!settledView || simWarm || dragNode.current || panning.current) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        runningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // ── Draw ── (plain per-render fn stored in a ref so the rAF loop always
  // calls the latest closure — no stale model.edges after an upload/delete).
  const draw = () => {
    const canvas = canvasRef.current;
    const pal = paletteRef.current;
    if (!canvas || !pal) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);

    const k = cur.current.k;
    const activeId = hoverRef.current ?? selectedRef.current;
    const flt = filterRef.current;

    // neighbourhood of the active node
    let neigh: Set<string> | null = null;
    if (activeId) {
      neigh = new Set([activeId]);
      for (const e of model.edges) {
        if (e.from === activeId) neigh.add(e.to);
        if (e.to === activeId) neigh.add(e.from);
      }
    }

    const nodePos = new Map<string, [number, number]>();
    for (const n of nodesRef.current) nodePos.set(n.id, project(n.x ?? 0, n.y ?? 0));

    // ── edges ──
    ctx.lineWidth = 1;
    for (const e of model.edges) {
      const a = nodePos.get(e.from);
      const b = nodePos.get(e.to);
      if (!a || !b) continue;
      const dim = neigh && !(neigh.has(e.from) && neigh.has(e.to));
      ctx.strokeStyle = e.kind === "weave" ? pal.accentLine : pal.border;
      ctx.globalAlpha = dim ? 0.06 : e.kind === "weave" ? 0.55 : e.kind === "related" ? 0.3 : 0.4;
      ctx.beginPath();
      if (e.kind === "related") ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const now = performance.now();

    // ── nodes ──
    for (const n of nodesRef.current) {
      const [px, py] = nodePos.get(n.id)!;
      const r = Math.max(worldRadius(n) * k, 2.5);
      const filteredOut = !passesFilter(n.kind, flt);
      const dim = (neigh && !neigh.has(n.id)) || filteredOut;
      const isSel = n.id === selectedRef.current;
      const isFocus = focusRef.current.has(n.id) || focusRef.current.has(n.id.replace(/^source:/, ""));

      ctx.globalAlpha = filteredOut ? 0.12 : dim ? 0.28 : 1;

      // focus pulse ring
      if (isFocus && !filteredOut) {
        const t = (now % 1600) / 1600;
        ctx.beginPath();
        ctx.arc(px, py, r + 4 + t * 12, 0, Math.PI * 2);
        ctx.strokeStyle = pal.accent;
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const teal = n.kind === "user-node" || n.kind === "source";
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = n.kind === "source" ? pal.accentLine : n.kind === "user-node" ? pal.accent : pal.surface2;
      ctx.fill();
      ctx.lineWidth = isSel ? 3 : n.kind === "user-node" ? 2 : 1.5;
      ctx.strokeStyle = isSel
        ? pal.accentOn
        : n.kind === "pillar"
          ? pal.borderStrong
          : teal
            ? pal.accent
            : pal.textMuted;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── labels (zoom-fade) ──
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (const n of nodesRef.current) {
      const filteredOut = !passesFilter(n.kind, flt);
      if (filteredOut) continue;
      const isSel = n.id === selectedRef.current;
      const isHover = hoverRef.current === n.id;
      const isFocus = focusRef.current.has(n.id);
      const show =
        n.kind === "pillar" ||
        isSel ||
        isHover ||
        isFocus ||
        (n.kind !== "topic" ? k >= 0.55 : k >= 0.85) ||
        (n.kind === "user-node" && k >= 0.7);
      if (!show) continue;
      const [px, py] = nodePos.get(n.id)!;
      const r = Math.max(worldRadius(n) * k, 2.5);
      const fontPx = n.kind === "pillar" ? 14 : 12;
      ctx.font = `${n.kind === "pillar" ? 600 : 400} ${fontPx}px Inter, system-ui, sans-serif`;
      const label = n.label.length > 36 ? n.label.slice(0, 35) + "…" : n.label;
      ctx.globalAlpha = isSel || isHover || n.kind === "pillar" ? 1 : 0.85;
      // subtle readability backing
      ctx.fillStyle = pal.bg;
      const tw = ctx.measureText(label).width;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(px - tw / 2 - 3, py - r - fontPx - 8, tw + 6, fontPx + 4);
      ctx.globalAlpha = isSel || isHover ? 1 : 0.9;
      ctx.fillStyle = isSel ? pal.textHead : pal.textPrimary;
      ctx.fillText(label, px, py - r - 6);
    }
    ctx.globalAlpha = 1;
  };
  drawRef.current = draw;

  // ── (Re)build the simulation when the model changes ──
  useEffect(() => {
    const nodes: SimNode[] = model.nodes.map((n) => ({ ...n, x: n.x, y: n.y }));
    const idIndex = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = model.edges
      .filter((e) => idIndex.has(e.from) && idIndex.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        "charge",
        forceManyBody<SimNode>().strength((d) =>
          d.kind === "pillar" ? -520 : d.kind === "source" ? -90 : -190
        )
      )
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "tree" ? 90 : l.kind === "weave" ? 64 : 130))
          .strength((l) => (l.kind === "tree" ? 0.5 : l.kind === "weave" ? 0.35 : 0.12))
      )
      .force("collide", forceCollide<SimNode>().radius((d) => worldRadius(d) + 7))
      .force("x", forceX(0).strength(0.035))
      .force("y", forceY(0).strength(0.035))
      .alpha(0.9)
      .alphaDecay(0.028);
    sim.stop(); // we tick manually in the rAF loop

    simRef.current = sim;
    nodesRef.current = nodes;
    paletteRef.current = readPalette();

    // fit once positions exist (seed layout is already sensible)
    fitToContent(false);
    kick();

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // ── Sizing (DPR-crisp) ──
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const measure = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w <= 1 || h <= 1) return; // not laid out yet — skip until it is
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      size.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      fitToContent(false); // snap the camera to the fitted view (no lerp-in from the corner)
      kick();
    };
    measure(); // measure immediately (RO's first callback is unreliable headless)
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    window.addEventListener("resize", measure);
    // Retry a couple of frames later in case the flex/grid width settles late.
    const t = setTimeout(measure, 60);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Native wheel (must preventDefault → no page scroll) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [sx, sy] = screenPos(e);
      const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
      zoomAt(sx, sy, factor);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ctrl/Cmd-K quick switcher ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQsOpen((o) => !o);
        setQsQuery("");
      } else if (e.key === "Escape") {
        setQsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Transform helpers ──
  function zoomAt(sx: number, sy: number, factor: number) {
    const t = target.current;
    const newK = Math.max(0.15, Math.min(6, t.k * factor));
    // anchor: world point under (sx,sy) using the TARGET transform
    const wx = (sx - t.tx) / t.k;
    const wy = (sy - t.ty) / t.k;
    t.k = newK;
    t.tx = sx - wx * newK;
    t.ty = sy - wy * newK;
    kick();
  }

  function fitToContent(animate: boolean) {
    const nodes = nodesRef.current;
    const { w, h } = size.current;
    if (nodes.length === 0 || w <= 1) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x ?? 0);
      minY = Math.min(minY, n.y ?? 0);
      maxX = Math.max(maxX, n.x ?? 0);
      maxY = Math.max(maxY, n.y ?? 0);
    }
    const pad = 80;
    const cw = maxX - minX || 1;
    const ch = maxY - minY || 1;
    const k = Math.max(0.15, Math.min(2, Math.min((w - pad * 2) / cw, (h - pad * 2) / ch)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    target.current = { k, tx: w / 2 - cx * k, ty: h / 2 - cy * k };
    if (!animate) cur.current = { ...target.current };
  }

  function flyTo(node: RenderNode) {
    const { w, h } = size.current;
    const k = Math.max(target.current.k, 1.1);
    target.current = { k, tx: w / 2 - node.x * k, ty: h / 2 - node.y * k };
    kick();
  }

  // ── Pointer interactions ──
  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* some pointer ids can't be captured (e.g. synthetic) — non-fatal */
    }
    const [sx, sy] = screenPos(e);
    pointers.current.set(e.pointerId, { x: sx, y: sy });
    movedRef.current = false;

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragNode.current = null;
      panning.current = null;
      return;
    }

    const hit = hitTest(sx, sy);
    if (hit) {
      dragNode.current = hit;
      const [wx, wy] = unproject(sx, sy);
      hit.fx = wx;
      hit.fy = wy;
      simRef.current?.alphaTarget(0.3);
      kick();
    } else {
      panning.current = { x: sx, y: sy };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const [sx, sy] = screenPos(e);
    const prev = pointers.current.get(e.pointerId);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: sx, y: sy });

    // pinch-zoom
    if (pointers.current.size === 2 && pinchDist.current != null) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      if (pinchDist.current > 0) zoomAt(mx, my, dist / pinchDist.current);
      pinchDist.current = dist;
      return;
    }

    if (dragNode.current) {
      movedRef.current = true;
      const [wx, wy] = unproject(sx, sy);
      dragNode.current.fx = wx;
      dragNode.current.fy = wy;
      kick();
      return;
    }

    if (panning.current) {
      movedRef.current = true;
      const dx = sx - panning.current.x;
      const dy = sy - panning.current.y;
      panning.current = { x: sx, y: sy };
      cur.current.tx += dx;
      cur.current.ty += dy;
      target.current.tx += dx;
      target.current.ty += dy;
      kick();
      return;
    }

    // hover (only when idle)
    if (prev === undefined) {
      const hit = hitTest(sx, sy);
      const id = hit?.id ?? null;
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        if (canvasRef.current) canvasRef.current.style.cursor = id ? "pointer" : "grab";
        kick();
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasNode = dragNode.current;
    const moved = movedRef.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;

    if (wasNode) {
      wasNode.fx = null;
      wasNode.fy = null;
      simRef.current?.alphaTarget(0);
      if (!moved) onSelect(wasNode.id);
      dragNode.current = null;
    } else if (panning.current) {
      if (!moved) onSelect(null); // click on empty space deselects
      panning.current = null;
    }
    kick();
  };

  // Quick-switcher matches
  const qsMatches = useMemo(() => {
    const q = qsQuery.trim().toLowerCase();
    if (!q) return [] as RenderNode[];
    return model.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
  }, [qsQuery, model.nodes]);

  const chooseQs = (n: RenderNode) => {
    setQsOpen(false);
    onSelect(n.id);
    const live = nodeById.get(n.id);
    if (live) flyTo(nodesRef.current.find((x) => x.id === n.id) ?? live);
  };

  const chip = (val: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(val)}
      aria-pressed={filter === val}
      className={`rounded-full px-3 text-xs border transition-colors ${
        filter === val
          ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-2)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)]"
      }`}
      style={{ minHeight: 32 }}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className="relative w-full h-full" style={{ touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full select-none"
        style={{ cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Filter chips */}
      <div className="absolute top-2 left-2 z-10 flex gap-1.5">
        {chip("all", "All")}
        {chip("files", "Your files")}
      </div>

      {/* Zoom / fit / find controls — 44px tap targets */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        {[
          { label: "+", fn: () => zoomAt(size.current.w / 2, size.current.h / 2, 1.25), aria: "Zoom in" },
          { label: "−", fn: () => zoomAt(size.current.w / 2, size.current.h / 2, 1 / 1.25), aria: "Zoom out" },
          { label: "⤢", fn: () => { fitToContent(true); kick(); }, aria: "Fit to view" },
          { label: "⌕", fn: () => { setQsOpen(true); setQsQuery(""); }, aria: "Find a note (Ctrl-K)" },
        ].map((c) => (
          <button
            key={c.aria}
            type="button"
            aria-label={c.aria}
            onClick={c.fn}
            className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ width: 44, height: 44 }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Quick switcher */}
      {qsOpen && (
        <div className="absolute inset-0 z-20 flex items-start justify-center pt-16" onClick={() => setQsOpen(false)}>
          <div
            className="w-[min(92%,460px)] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={qsQuery}
              onChange={(e) => setQsQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && qsMatches[0]) chooseQs(qsMatches[0]);
              }}
              placeholder="Find a note…"
              className="w-full bg-transparent px-4 py-3 text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
              style={{ fontSize: 16 }}
            />
            {qsMatches.length > 0 && (
              <ul className="max-h-64 overflow-auto border-t border-[var(--border)]">
                {qsMatches.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => chooseQs(n)}
                      className="w-full text-left px-4 py-2 hover:bg-[var(--surface-2)] flex items-center gap-2"
                      style={{ minHeight: 40 }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{
                          background:
                            n.kind === "user-node" || n.kind === "source"
                              ? "var(--accent)"
                              : "var(--text-muted)",
                        }}
                      />
                      <span className="text-sm text-[var(--text-body)] truncate">{n.label}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        {n.kind === "user-node" ? "your topic" : n.kind === "source" ? "your file" : n.kind}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
