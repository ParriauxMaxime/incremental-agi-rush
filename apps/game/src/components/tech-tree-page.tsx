import { css } from "@emotion/react";
import { Background, type Edge, type Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeStateEnum, TechNodeComponent } from "@agi-rush/design-system";
import type { TechNode } from "@modules/game";
import { allTechNodes, getTechNodeCost, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo, useRef, useState } from "react";
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

function buildFlowEdges(
	techNodes: TechNode[],
	ownedTechNodes: Record<string, number>,
): Edge[] {
	const edges: Edge[] = [];
	for (const n of techNodes) {
		const prereqsMet =
			n.requires.length === 0 ||
			n.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);
		if (!prereqsMet) continue;

		for (const req of n.requires) {
			edges.push({
				id: `${req}->${n.id}`,
				source: req,
				target: n.id,
				type: "straight",
				style: { stroke: "#1e2630", strokeWidth: 2, opacity: 0.6 },
			});
		}
	}
	return edges;
}

// ── Styles ──

const containerCss = css({
	flex: 1,
	position: "relative",
	background: "#0d1117",
	".react-flow__background": { background: "#0d1117 !important" },
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

// ── Popover ──

interface PopoverProps {
	node: TechNode;
	x: number;
	y: number;
}

function NodePopover({ node, x, y }: PopoverProps) {
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

	return (
		<div css={popoverCss} style={{ left: x, top: y }}>
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
	const isMobile = useIsMobile();
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const researchNode = useGameStore((s) => s.researchNode);
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
		() => buildFlowEdges(allTechNodes, ownedTechNodes),
		[ownedTechNodes],
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
			maxX = Math.max(maxX, x + 140);
			maxY = Math.max(maxY, y + 56);
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

	return (
		<div ref={containerRef} css={containerCss}>
			<ReactFlow
				nodes={flowNodes}
				edges={flowEdges}
				nodeTypes={nodeTypes}
				onNodeClick={handleNodeClick}
				onNodeMouseEnter={isMobile ? undefined : handleNodeMouseEnter}
				onNodeMouseLeave={isMobile ? undefined : handleNodeMouseLeave}
				onPaneClick={isMobile ? () => setHovered(null) : undefined}
				fitView
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				panOnDrag
				zoomOnScroll={false}
				zoomOnPinch={false}
				zoomOnDoubleClick={false}
				minZoom={1}
				maxZoom={1}
				translateExtent={translateExtent}
				proOptions={{ hideAttribution: true }}
			>
				<Background gap={20} color="#1e2630" />
			</ReactFlow>

			{hovered && (
				<NodePopover node={hovered.node} x={hovered.x} y={hovered.y} />
			)}
		</div>
	);
}
