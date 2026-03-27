import { css } from "@emotion/react";
import { Background, type Edge, type Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	formatEffect,
	NodeStateEnum,
	TECH_NODE_HEIGHT,
	TECH_NODE_WIDTH,
	TechNodeComponent,
} from "@agi-rush/design-system";
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

// ── Build React Flow data from game state ──

function buildFlowNodes(
	techNodes: TechNode[],
	ownedTechNodes: Record<string, number>,
	loc: number,
	cash: number,
): Node[] {
	const nodes: Node[] = [];
	for (const n of techNodes) {
		const owned = ownedTechNodes[n.id] ?? 0;
		const maxed = owned >= n.max;
		const prereqsMet =
			n.requires.length === 0 ||
			n.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);

		// Hide locked nodes
		if (!prereqsMet) continue;

		const cost = getTechNodeCost(n, owned);
		const useLoc = n.currency === "loc";
		const canAfford = useLoc ? loc >= cost : cash >= cost;

		let state: NodeStateEnum;
		if (maxed) state = NodeStateEnum.owned;
		else if (canAfford) state = NodeStateEnum.affordable;
		else state = NodeStateEnum.visible;

		nodes.push({
			id: n.id,
			type: "techNode",
			position: { x: n.x ?? 0, y: n.y ?? 0 },
			data: { ...n, state, owned },
		});
	}
	return nodes;
}

function getHandlePair(
	source: TechNode,
	target: TechNode,
): { sourceHandle: string; targetHandle: string } {
	const sy = source.y ?? 0;
	const ty = target.y ?? 0;

	// Tree flows top-to-bottom: source is the prerequisite (higher up)
	if (ty > sy) return { sourceHandle: "bottom", targetHandle: "top" };
	if (ty < sy) return { sourceHandle: "top", targetHandle: "bottom" };

	// Same row — use horizontal
	const sx = source.x ?? 0;
	const tx = target.x ?? 0;
	return tx >= sx
		? { sourceHandle: "right", targetHandle: "left" }
		: { sourceHandle: "left", targetHandle: "right" };
}

function buildFlowEdges(
	techNodes: TechNode[],
	ownedTechNodes: Record<string, number>,
	borderColor: string,
): Edge[] {
	const nodeMap = new Map(techNodes.map((n) => [n.id, n]));
	const edges: Edge[] = [];
	for (const n of techNodes) {
		const prereqsMet =
			n.requires.length === 0 ||
			n.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);
		if (!prereqsMet) continue;

		for (const req of n.requires) {
			const sourceNode = nodeMap.get(req);
			if (!sourceNode) continue;
			const { sourceHandle, targetHandle } = getHandlePair(sourceNode, n);
			edges.push({
				id: `${req}->${n.id}`,
				source: req,
				target: n.id,
				sourceHandle,
				targetHandle,
				type: "smoothstep",
				style: {
					stroke: borderColor,
					strokeWidth: 1.5,
					opacity: 0.5,
				},
			});
		}
	}
	return edges;
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

	const flowEdges = useMemo(
		() => buildFlowEdges(allTechNodes, ownedTechNodes, theme.textMuted),
		[ownedTechNodes, theme.textMuted],
	);

	// Compute pan bounds from all node positions (not just visible ones)
	const translateExtent = useMemo((): [[number, number], [number, number]] => {
		const padding = 200;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const n of allTechNodes) {
			const x = n.x ?? 0;
			const y = n.y ?? 0;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x + TECH_NODE_WIDTH);
			maxY = Math.max(maxY, y + TECH_NODE_HEIGHT);
		}
		return [
			[minX - padding, minY - padding],
			[maxX + padding, maxY + padding],
		];
	}, []);

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
				edges={flowEdges}
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
				<Background gap={20} color={theme.border} />
			</ReactFlow>

			{hovered && (
				<NodePopover node={hovered.node} x={hovered.x} y={hovered.y} />
			)}
		</div>
	);
}
