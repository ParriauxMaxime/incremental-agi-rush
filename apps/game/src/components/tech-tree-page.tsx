import { css } from "@emotion/react";
import {
	Background,
	type Edge,
	type EdgeProps,
	type Node,
	ReactFlow,
	useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	formatEffect,
	NodeStateEnum,
	TECH_NODE_HEIGHT,
	TECH_NODE_WIDTH,
	TechNodeComponent,
} from "@agi-rush/design-system";
import dagre from "@dagrejs/dagre";
import type { TechNode } from "@modules/game";
import {
	allTechNodes,
	getTechNodeCost,
	useGameStore,
	useUiStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo, useRef, useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useIsMobile } from "../hooks/use-is-mobile";

// ── Node types ──

const nodeTypes = { techNode: TechNodeComponent };

// ── Dagre auto-layout for visible nodes ──

function computeLayout(
	visibleIds: Set<string>,
	techNodes: TechNode[],
): Map<string, { x: number; y: number }> {
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: "TB",
		nodesep: 40,
		ranksep: 60,
		marginx: 20,
		marginy: 20,
	});
	g.setDefaultEdgeLabel(() => ({}));

	for (const n of techNodes) {
		if (!visibleIds.has(n.id)) continue;
		g.setNode(n.id, { width: TECH_NODE_WIDTH, height: TECH_NODE_HEIGHT });
	}

	for (const n of techNodes) {
		if (!visibleIds.has(n.id)) continue;
		for (const req of n.requires) {
			if (visibleIds.has(req)) {
				g.setEdge(req, n.id);
			}
		}
	}

	dagre.layout(g);

	const positions = new Map<string, { x: number; y: number }>();
	for (const id of visibleIds) {
		const node = g.node(id);
		if (node) {
			positions.set(id, {
				x: node.x - TECH_NODE_WIDTH / 2,
				y: node.y - TECH_NODE_HEIGHT / 2,
			});
		}
	}
	return positions;
}

// ── Build React Flow data from game state ──

function buildFlowNodes(
	techNodes: TechNode[],
	ownedTechNodes: Record<string, number>,
	loc: number,
	cash: number,
): Node[] {
	// First pass: determine visible nodes
	const visibleIds = new Set<string>();
	for (const n of techNodes) {
		const prereqsMet =
			n.requires.length === 0 ||
			n.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);
		if (prereqsMet) visibleIds.add(n.id);
	}

	// Compute layout based on visible nodes only
	const positions = computeLayout(visibleIds, techNodes);

	const nodes: Node[] = [];
	for (const n of techNodes) {
		if (!visibleIds.has(n.id)) continue;

		const owned = ownedTechNodes[n.id] ?? 0;
		const maxed = owned >= n.max;
		const cost = getTechNodeCost(n, owned);
		const useLoc = n.currency === "loc";
		const canAfford = useLoc ? loc >= cost : cash >= cost;

		let state: NodeStateEnum;
		if (maxed) state = NodeStateEnum.owned;
		else if (canAfford) state = NodeStateEnum.affordable;
		else state = NodeStateEnum.visible;

		const pos = positions.get(n.id) ?? { x: n.x ?? 0, y: n.y ?? 0 };

		nodes.push({
			id: n.id,
			type: "techNode",
			position: pos,
			data: { ...n, state, owned },
		});
	}
	return nodes;
}

// ── Bundled edge rendering ──

interface EdgeDef {
	sourceId: string;
	targetId: string;
	sx: number;
	sy: number;
	tx: number;
	ty: number;
}

function buildEdgeDefs(
	flowNodes: Node[],
	techNodes: TechNode[],
	ownedTechNodes: Record<string, number>,
): EdgeDef[] {
	const posMap = new Map(flowNodes.map((n) => [n.id, n.position]));
	const edges: EdgeDef[] = [];
	for (const n of techNodes) {
		const targetPos = posMap.get(n.id);
		if (!targetPos) continue;

		for (const req of n.requires) {
			const srcPos = posMap.get(req);
			if (!srcPos) continue;
			edges.push({
				sourceId: req,
				targetId: n.id,
				sx: srcPos.x + TECH_NODE_WIDTH / 2,
				sy: srcPos.y + TECH_NODE_HEIGHT,
				tx: targetPos.x + TECH_NODE_WIDTH / 2,
				ty: targetPos.y,
			});
		}
	}
	return edges;
}

/** Check if a line segment passes through any node bounding box */
function findBlockingNode(
	sx: number,
	sy: number,
	tx: number,
	ty: number,
	nodePositions: Map<string, { x: number; y: number }>,
	excludeIds: Set<string>,
): { x: number; y: number } | null {
	const midY = (sy + ty) / 2;
	for (const [id, pos] of nodePositions) {
		if (excludeIds.has(id)) continue;
		const nx = pos.x;
		const ny = pos.y;
		const pad = 8;
		if (
			sx > nx - pad &&
			sx < nx + TECH_NODE_WIDTH + pad &&
			midY > ny - pad &&
			midY < ny + TECH_NODE_HEIGHT + pad
		) {
			return pos;
		}
	}
	return null;
}

function buildBundledPaths(
	edges: EdgeDef[],
	nodePositions: Map<string, { x: number; y: number }>,
	color: string,
): Array<{ d: string; strokeWidth: number; opacity: number }> {
	// Group edges by source
	const bySource = new Map<string, EdgeDef[]>();
	for (const e of edges) {
		const group = bySource.get(e.sourceId) ?? [];
		group.push(e);
		bySource.set(e.sourceId, group);
	}

	const paths: Array<{ d: string; strokeWidth: number; opacity: number }> = [];

	for (const [sourceId, group] of bySource) {
		if (group.length === 0) continue;
		const sx = group[0].sx;
		const sy = group[0].sy;

		if (group.length === 1) {
			// Single edge — simple bezier
			const e = group[0];
			const excludeIds = new Set([e.sourceId, e.targetId]);
			const blocker = findBlockingNode(
				sx,
				sy,
				e.tx,
				e.ty,
				nodePositions,
				excludeIds,
			);

			if (blocker) {
				// Route around: go to the side then down
				const bx = blocker.x;
				const side =
					sx <= bx + TECH_NODE_WIDTH / 2 ? bx - 16 : bx + TECH_NODE_WIDTH + 16;
				paths.push({
					d: `M ${sx} ${sy} C ${sx} ${sy + 30}, ${side} ${(sy + e.ty) / 2}, ${side} ${(sy + e.ty) / 2} S ${e.tx} ${e.ty - 30}, ${e.tx} ${e.ty}`,
					strokeWidth: 1.5,
					opacity: 0.4,
				});
			} else {
				const midY = (sy + e.ty) / 2;
				paths.push({
					d: `M ${sx} ${sy} C ${sx} ${midY}, ${e.tx} ${midY}, ${e.tx} ${e.ty}`,
					strokeWidth: 1.5,
					opacity: 0.4,
				});
			}
		} else {
			// Multiple edges from same source — bundle them
			// Sort targets by X position
			const sorted = [...group].sort((a, b) => a.tx - b.tx);

			// Compute trunk: vertical line down from source to a junction point
			const minTy = Math.min(...sorted.map((e) => e.ty));
			const junctionY = sy + (minTy - sy) * 0.5;

			// Trunk (thicker)
			paths.push({
				d: `M ${sx} ${sy} L ${sx} ${junctionY}`,
				strokeWidth: 2.5,
				opacity: 0.35,
			});

			// Branches from junction to each target
			for (const e of sorted) {
				paths.push({
					d: `M ${sx} ${junctionY} C ${sx} ${(junctionY + e.ty) / 2}, ${e.tx} ${(junctionY + e.ty) / 2}, ${e.tx} ${e.ty}`,
					strokeWidth: 1.5,
					opacity: 0.4,
				});
			}
		}
	}

	return paths;
}

/** SVG overlay for bundled edges — reads viewport transform from React Flow */
function BundledEdges({
	edges,
	flowNodes,
	color,
}: {
	edges: EdgeDef[];
	flowNodes: Node[];
	color: string;
}) {
	const { x, y, zoom } = useViewport();
	const nodePositions = useMemo(
		() => new Map(flowNodes.map((n) => [n.id, n.position])),
		[flowNodes],
	);
	const paths = useMemo(
		() => buildBundledPaths(edges, nodePositions, color),
		[edges, nodePositions, color],
	);

	return (
		<svg
			css={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				overflow: "visible",
				zIndex: 0,
			}}
		>
			<g transform={`translate(${x}, ${y}) scale(${zoom})`}>
				{paths.map((p, i) => (
					<path
						key={i}
						d={p.d}
						stroke={color}
						strokeWidth={p.strokeWidth / zoom}
						fill="none"
						opacity={p.opacity}
						strokeLinecap="round"
					/>
				))}
			</g>
		</svg>
	);
}

// ── Styles ──

const containerBaseCss = css({
	flex: 1,
	position: "relative",
	".react-flow__handle": {
		width: 0,
		height: 0,
		minWidth: 0,
		minHeight: 0,
		border: "none",
		background: "transparent",
	},
});

// ── Popover ──

interface PopoverProps {
	node: TechNode;
	x: number;
	y: number;
}

function NodePopover({ node, x, y }: PopoverProps) {
	const theme = useIdeTheme();
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

	const popoverStyle = css({
		position: "absolute",
		zIndex: 10,
		pointerEvents: "none",
		background: theme.panelBg,
		border: `1px solid ${theme.border}`,
		borderRadius: 8,
		padding: 12,
		minWidth: 220,
		maxWidth: 280,
		boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
	});

	const popoverNameStyle = css({
		fontSize: 14,
		fontWeight: "bold",
		color: theme.foreground,
		marginBottom: 4,
	});

	const popoverDescStyle = css({
		fontSize: 12,
		color: theme.textMuted,
		marginBottom: 8,
	});

	const popoverDetailStyle = css({
		fontSize: 11,
		color: theme.textMuted,
		marginBottom: 2,
	});

	return (
		<div css={popoverStyle} style={{ left: x, top: y }}>
			<div css={popoverNameStyle}>
				{node.icon} {node.name}
			</div>
			<div css={popoverDescStyle}>{node.description}</div>
			{node.effects.length > 0 && (
				<div css={popoverDetailStyle}>
					{node.effects.map((e) => formatEffect(e)).join(", ")}
				</div>
			)}
			{levelLabel && !maxed && <div css={popoverDetailStyle}>{levelLabel}</div>}
			{node.max > 1 && (
				<div css={popoverDetailStyle}>
					Level {owned}/{node.max}
				</div>
			)}
			{!maxed && (
				<div css={popoverDetailStyle}>
					Cost:{" "}
					{useLoc ? `${formatNumber(cost)} LoC` : `$${formatNumber(cost)}`}
				</div>
			)}
			{!prereqsMet && !maxed && (
				<div css={[popoverDetailStyle, { color: "#e94560" }]}>
					Requires:{" "}
					{node.requires
						.filter((id) => (ownedTechNodes[id] ?? 0) === 0)
						.map((id) => allTechNodes.find((n) => n.id === id)?.name ?? id)
						.join(", ")}
				</div>
			)}
			{maxed && (
				<div css={{ fontSize: 12, color: theme.success, fontWeight: "bold" }}>
					{node.max === 1 ? "Researched" : "Maxed"}
				</div>
			)}
			{!maxed && prereqsMet && canAfford && (
				<div css={{ fontSize: 11, color: theme.accent, marginTop: 4 }}>
					Click to research
				</div>
			)}
			{!maxed && prereqsMet && !canAfford && (
				<div css={{ fontSize: 11, color: "#e94560", marginTop: 4 }}>
					Not enough {useLoc ? "LoC" : "cash"}
				</div>
			)}
			{!maxed && !prereqsMet && (
				<div css={{ fontSize: 11, color: theme.lineNumbers, marginTop: 4 }}>
					Locked
				</div>
			)}
		</div>
	);
}

// ── Main component ──

export function TechTreePage() {
	const theme = useIdeTheme();
	const isMobile = useIsMobile();
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const researchNode = useGameStore((s) => s.researchNode);
	const techTreeViewport = useUiStore((s) => s.techTreeViewport);
	const setTechTreeViewport = useUiStore((s) => s.setTechTreeViewport);
	const containerRef = useRef<HTMLDivElement>(null);

	// Throttle node rebuilds to avoid React Flow DOM churn on every game tick.
	// Only recompute every 500ms, or immediately when purchases change.
	const lastBuild = useRef(0);
	const cachedNodes = useRef<Node[]>([]);
	const prevOwned = useRef(ownedTechNodes);

	const flowNodes = useMemo(() => {
		const now = Date.now();
		const ownedChanged = prevOwned.current !== ownedTechNodes;
		if (
			ownedChanged ||
			now - lastBuild.current > 500 ||
			cachedNodes.current.length === 0
		) {
			prevOwned.current = ownedTechNodes;
			lastBuild.current = now;
			cachedNodes.current = buildFlowNodes(
				allTechNodes,
				ownedTechNodes,
				loc,
				cash,
			);
		}
		return cachedNodes.current;
	}, [ownedTechNodes, loc, cash]);

	const edgeDefs = useMemo(
		() => buildEdgeDefs(flowNodes, allTechNodes, ownedTechNodes),
		[flowNodes, ownedTechNodes],
	);

	const emptyEdges: Edge[] = useMemo(() => [], []);

	// Compute pan bounds from visible node positions
	const translateExtent = useMemo((): [[number, number], [number, number]] => {
		const padding = 200;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const n of flowNodes) {
			const x = n.position.x;
			const y = n.position.y;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x + TECH_NODE_WIDTH);
			maxY = Math.max(maxY, y + TECH_NODE_HEIGHT);
		}
		return [
			[minX - padding, minY - padding],
			[maxX + padding, maxY + padding],
		];
	}, [flowNodes]);

	const [hovered, setHovered] = useState<{
		node: TechNode;
		x: number;
		y: number;
	} | null>(null);
	const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleNodeClick = useCallback(
		(e: React.MouseEvent, node: Node) => {
			const techNode = allTechNodes.find((n) => n.id === node.id);
			if (!techNode) return;
			const owned = ownedTechNodes[techNode.id] ?? 0;
			const maxed = owned >= techNode.max;
			const cost = getTechNodeCost(techNode, owned);
			const useLoc = techNode.currency === "loc";
			const canAfford = useLoc ? loc >= cost : cash >= cost;

			if (!maxed && canAfford) {
				researchNode(techNode);
				if (isMobile) setHovered(null);
			} else if (isMobile && containerRef.current) {
				// On mobile, show popover on tap for non-affordable nodes
				const containerRect = containerRef.current.getBoundingClientRect();
				setHovered({
					node: techNode,
					x: e.clientX - containerRect.left + 12,
					y: e.clientY - containerRect.top,
				});
			}
		},
		[ownedTechNodes, loc, cash, researchNode, isMobile],
	);

	const handleNodeMouseEnter = useCallback(
		(e: React.MouseEvent, node: Node) => {
			clearTimeout(leaveTimer.current);
			const techNode = allTechNodes.find((n) => n.id === node.id);
			if (techNode && containerRef.current) {
				const el = e.currentTarget as HTMLElement;
				const containerRect = containerRef.current.getBoundingClientRect();
				const nodeRect = el.getBoundingClientRect();
				setHovered({
					node: techNode,
					x: nodeRect.right - containerRect.left + 12,
					y: nodeRect.top - containerRect.top,
				});
			}
		},
		[],
	);

	const handleNodeMouseLeave = useCallback(() => {
		leaveTimer.current = setTimeout(() => setHovered(null), 100);
	}, []);

	const containerDynamicCss = css({
		background: theme.background,
		".react-flow__background": { background: `${theme.background} !important` },
	});

	return (
		<div ref={containerRef} css={[containerBaseCss, containerDynamicCss]}>
			<ReactFlow
				nodes={flowNodes}
				edges={emptyEdges}
				nodeTypes={nodeTypes}
				onNodeClick={handleNodeClick}
				onNodeMouseEnter={isMobile ? undefined : handleNodeMouseEnter}
				onNodeMouseLeave={isMobile ? undefined : handleNodeMouseLeave}
				onPaneClick={isMobile ? () => setHovered(null) : undefined}
				defaultViewport={techTreeViewport}
				onViewportChange={setTechTreeViewport}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				panOnDrag
				zoomOnScroll
				zoomOnPinch
				zoomOnDoubleClick={false}
				minZoom={0.5}
				maxZoom={2}
				translateExtent={translateExtent}
				proOptions={{ hideAttribution: true }}
			>
				<BundledEdges
					edges={edgeDefs}
					flowNodes={flowNodes}
					color={theme.textMuted}
				/>
				<Background gap={20} color={theme.border} />
			</ReactFlow>

			{hovered && (
				<NodePopover node={hovered.node} x={hovered.x} y={hovered.y} />
			)}
		</div>
	);
}
