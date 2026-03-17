import dagre from "@dagrejs/dagre";
import { css } from "@emotion/react";
import type { TechNode } from "@modules/game";
import { allTechNodes, getTechNodeCost, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import {
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

// ── Constants ──

const NODE_W = 172;
const NODE_H = 58;
const NODE_RX = 8;
const ICON_SIZE = 20;

// ── Layout ──

interface LayoutNode {
	node: TechNode;
	x: number;
	y: number;
}

interface LayoutEdge {
	from: string;
	to: string;
	points: Array<{ x: number; y: number }>;
}

interface TreeLayout {
	nodes: LayoutNode[];
	edges: LayoutEdge[];
	width: number;
	height: number;
}

function computeLayout(techNodes: TechNode[]): TreeLayout {
	const hasEditorPositions = techNodes.some((n) => n.x != null && n.y != null);

	let nodes: LayoutNode[];

	if (hasEditorPositions) {
		// Use positions from the tech tree editor
		nodes = techNodes.map((n) => ({
			node: n,
			x: (n.x ?? 0) + NODE_W / 2,
			y: (n.y ?? 0) + NODE_H / 2,
		}));
	} else {
		// Fallback: dagre auto-layout
		const g = new dagre.graphlib.Graph();
		g.setGraph({
			rankdir: "TB",
			nodesep: 40,
			ranksep: 60,
			marginx: 40,
			marginy: 40,
		});
		g.setDefaultEdgeLabel(() => ({}));

		for (const n of techNodes) {
			g.setNode(n.id, { width: NODE_W, height: NODE_H });
		}
		for (const n of techNodes) {
			for (const req of n.requires) {
				g.setEdge(req, n.id);
			}
		}

		dagre.layout(g);

		nodes = techNodes.map((n) => {
			const pos = g.node(n.id);
			return { node: n, x: pos.x, y: pos.y };
		});
	}

	// Build edges as straight lines between node centers
	const nodeMap = new Map(nodes.map((ln) => [ln.node.id, ln]));
	const edges: LayoutEdge[] = [];
	for (const n of techNodes) {
		for (const reqId of n.requires) {
			const from = nodeMap.get(reqId);
			const to = nodeMap.get(n.id);
			if (from && to) {
				edges.push({
					from: reqId,
					to: n.id,
					points: [
						{ x: from.x, y: from.y + NODE_H / 2 },
						{ x: to.x, y: to.y - NODE_H / 2 },
					],
				});
			}
		}
	}

	const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_W;
	const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_H;

	return {
		nodes,
		edges,
		width: maxX,
		height: maxY,
	};
}

// ── Pan / Zoom hook ──

function usePanZoom() {
	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
	const isPanning = useRef(false);
	const lastPos = useRef({ x: 0, y: 0 });

	const onWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setTransform((t) => ({
			...t,
			scale: Math.max(0.2, Math.min(3, t.scale * delta)),
		}));
	}, []);

	const onMouseDown = useCallback((e: ReactMouseEvent) => {
		if (e.button !== 0) return;
		isPanning.current = true;
		lastPos.current = { x: e.clientX, y: e.clientY };
	}, []);

	const onMouseMove = useCallback((e: ReactMouseEvent) => {
		if (!isPanning.current) return;
		const dx = e.clientX - lastPos.current.x;
		const dy = e.clientY - lastPos.current.y;
		lastPos.current = { x: e.clientX, y: e.clientY };
		setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
	}, []);

	const onMouseUp = useCallback(() => {
		isPanning.current = false;
	}, []);

	return { transform, onWheel, onMouseDown, onMouseMove, onMouseUp };
}

// ── Styles ──

const containerCss = css({
	flex: 1,
	overflow: "hidden",
	position: "relative",
	background: "#0d1117",
	cursor: "grab",
	"&:active": { cursor: "grabbing" },
});

const svgCss = css({
	display: "block",
	width: "100%",
	height: "100%",
});

const popoverCss = css({
	position: "absolute",
	zIndex: 10,
	pointerEvents: "none",
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 8,
	padding: 12,
	minWidth: 220,
	maxWidth: 280,
	boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
});

const popoverNameCss = css({
	fontSize: 14,
	fontWeight: "bold",
	color: "#c9d1d9",
	marginBottom: 4,
});

const popoverDescCss = css({
	fontSize: 12,
	color: "#6272a4",
	marginBottom: 8,
});

const popoverDetailCss = css({
	fontSize: 11,
	color: "#8b949e",
	marginBottom: 2,
});

// ── Edge component ──

function EdgePath({ edge }: { edge: LayoutEdge }) {
	const pts = edge.points;
	if (pts.length < 2) return null;

	let d = `M ${pts[0].x} ${pts[0].y}`;
	for (let i = 1; i < pts.length; i++) {
		d += ` L ${pts[i].x} ${pts[i].y}`;
	}

	return (
		<path d={d} fill="none" stroke="#1e2630" strokeWidth={2} opacity={0.6} />
	);
}

// ── Node component (SVG) ──

interface SvgNodeProps {
	ln: LayoutNode;
	owned: number;
	prereqsMet: boolean;
	canResearch: boolean;
	onClick: () => void;
	onHover: (nodeId: string | null, rect: DOMRect | null) => void;
}

function SvgNode({
	ln,
	owned,
	prereqsMet,
	canResearch,
	onClick,
	onHover,
}: SvgNodeProps) {
	const maxed = owned >= ln.node.max;
	const ref = useRef<SVGGElement>(null);

	let stroke = "#1e2630";
	let opacity = 0.4;
	if (maxed) {
		stroke = "#3fb950";
		opacity = 0.7;
	} else if (canResearch) {
		stroke = "#58a6ff";
		opacity = 1;
	} else if (prereqsMet) {
		// Visible but not affordable — faded
		stroke = "#1e2630";
		opacity = 0.35;
	}

	const handleMouseEnter = () => {
		const el = ref.current;
		if (el) onHover(ln.node.id, el.getBoundingClientRect());
	};

	const handleClick = (e: ReactMouseEvent) => {
		e.stopPropagation();
		if (canResearch) onClick();
	};

	return (
		<g
			ref={ref}
			transform={`translate(${ln.x - NODE_W / 2}, ${ln.y - NODE_H / 2})`}
			opacity={opacity}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={() => onHover(null, null)}
			onClick={handleClick}
			style={{ cursor: canResearch ? "pointer" : "default" }}
		>
			<rect
				width={NODE_W}
				height={NODE_H}
				rx={NODE_RX}
				fill="#161b22"
				stroke={stroke}
				strokeWidth={1.5}
			/>
			<text
				x={ICON_SIZE + 14}
				y={NODE_H / 2 - 7}
				fill="#c9d1d9"
				fontSize={14}
				fontWeight="bold"
				fontFamily="inherit"
			>
				{ln.node.name}
			</text>
			<text
				x={ICON_SIZE + 14}
				y={NODE_H / 2 + 11}
				fill="#6272a4"
				fontSize={12}
				fontFamily="inherit"
			>
				{maxed
					? ln.node.max === 1
						? "Researched"
						: `${owned}/${ln.node.max}`
					: `${owned}/${ln.node.max}`}
			</text>
			<text x={8} y={NODE_H / 2 + 6} fontSize={ICON_SIZE}>
				{ln.node.icon}
			</text>
		</g>
	);
}

// ── Popover ──

interface PopoverProps {
	node: TechNode;
	rect: DOMRect;
	containerRect: DOMRect;
}

function NodePopover({ node, rect, containerRect }: PopoverProps) {
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);

	const owned = ownedTechNodes[node.id] ?? 0;
	const maxed = owned >= node.max;
	const prereqsMet = node.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);
	const cost = getTechNodeCost(node, owned);
	const useLoc = node.currency === "loc";
	const canAfford = useLoc ? loc >= cost : cash >= cost;
	const levelLabel = node.levelLabels?.[owned];

	const left = rect.right - containerRect.left + 12;
	const top = rect.top - containerRect.top;

	return (
		<div css={popoverCss} style={{ left, top }}>
			<div css={popoverNameCss}>
				{node.icon} {node.name}
			</div>
			<div css={popoverDescCss}>{node.description}</div>
			{levelLabel && !maxed && <div css={popoverDetailCss}>{levelLabel}</div>}
			{node.max > 1 && (
				<div css={popoverDetailCss}>
					Level {owned}/{node.max}
				</div>
			)}
			{!maxed && (
				<div css={popoverDetailCss}>
					Cost:{" "}
					{useLoc ? `${formatNumber(cost)} LoC` : `$${formatNumber(cost)}`}
				</div>
			)}
			{!prereqsMet && !maxed && (
				<div css={[popoverDetailCss, { color: "#e94560" }]}>
					Requires:{" "}
					{node.requires
						.filter((id) => (ownedTechNodes[id] ?? 0) === 0)
						.map((id) => allTechNodes.find((n) => n.id === id)?.name ?? id)
						.join(", ")}
				</div>
			)}
			{maxed && (
				<div css={{ fontSize: 12, color: "#3fb950", fontWeight: "bold" }}>
					{node.max === 1 ? "Researched" : "Maxed"}
				</div>
			)}
			{!maxed && prereqsMet && canAfford && (
				<div css={{ fontSize: 11, color: "#58a6ff", marginTop: 4 }}>
					Click to research
				</div>
			)}
			{!maxed && prereqsMet && !canAfford && (
				<div css={{ fontSize: 11, color: "#e94560", marginTop: 4 }}>
					Not enough {useLoc ? "LoC" : "cash"}
				</div>
			)}
			{!maxed && !prereqsMet && (
				<div css={{ fontSize: 11, color: "#484f58", marginTop: 4 }}>Locked</div>
			)}
		</div>
	);
}

// ── Main component ──

export function TechTreePage() {
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const researchNode = useGameStore((s) => s.researchNode);
	const containerRef = useRef<HTMLDivElement>(null);
	const { transform, onWheel, onMouseDown, onMouseMove, onMouseUp } =
		usePanZoom();

	const treeLayout = useMemo(() => computeLayout(allTechNodes), []);

	const [hovered, setHovered] = useState<{
		nodeId: string;
		rect: DOMRect;
	} | null>(null);

	const handleHover = useCallback(
		(nodeId: string | null, rect: DOMRect | null) => {
			if (nodeId && rect) {
				setHovered({ nodeId, rect });
			} else {
				setHovered(null);
			}
		},
		[],
	);

	// Center the tree on mount
	useEffect(() => {
		// Intentionally empty — initial transform (0,0,1) with viewBox centers it
	}, []);

	const hoveredNode = hovered
		? allTechNodes.find((n) => n.id === hovered.nodeId)
		: null;
	const containerRect = containerRef.current?.getBoundingClientRect();

	return (
		<div
			ref={containerRef}
			css={containerCss}
			role="application"
			onWheel={onWheel}
			onMouseDown={onMouseDown}
			onMouseMove={onMouseMove}
			onMouseUp={onMouseUp}
			onMouseLeave={onMouseUp}
		>
			<svg css={svgCss} role="img" aria-label="Tech tree">
				<g
					transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
				>
					{/* Edges — only show if target node is visible */}
					{treeLayout.edges.map((e) => {
						const targetNode = allTechNodes.find((n) => n.id === e.to);
						if (!targetNode) return null;
						// Show edge if target's prereqs are met (node is visible)
						const targetVisible = targetNode.requires.every(
							(id) => (ownedTechNodes[id] ?? 0) > 0,
						);
						// Also show if target has no requires (root)
						if (!targetVisible && targetNode.requires.length > 0) return null;
						return <EdgePath key={`${e.from}-${e.to}`} edge={e} />;
					})}

					{/* Nodes — hidden until prereqs met */}
					{treeLayout.nodes.map((ln) => {
						const owned = ownedTechNodes[ln.node.id] ?? 0;
						const maxed = owned >= ln.node.max;
						const prereqsMet =
							ln.node.requires.length === 0 ||
							ln.node.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);
						if (!prereqsMet) return null;

						const cost = getTechNodeCost(ln.node, owned);
						const useLoc = ln.node.currency === "loc";
						const canAfford = useLoc ? loc >= cost : cash >= cost;
						const canResearch = prereqsMet && canAfford && !maxed;
						return (
							<SvgNode
								key={ln.node.id}
								ln={ln}
								owned={owned}
								prereqsMet={prereqsMet}
								canResearch={canResearch}
								onClick={() => researchNode(ln.node)}
								onHover={handleHover}
							/>
						);
					})}
				</g>
			</svg>

			{/* Popover */}
			{hoveredNode && hovered && containerRect && (
				<NodePopover
					node={hoveredNode}
					rect={hovered.rect}
					containerRect={containerRect}
				/>
			)}
		</div>
	);
}
