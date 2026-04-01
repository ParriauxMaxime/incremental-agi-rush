import { css } from "@emotion/react";
import {
	Background,
	type Edge,
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
	type TechNodeTheme,
} from "@flopsed/design-system";
import type { TechNode } from "@modules/game";
import {
	allTechNodes,
	getTechNodeCost,
	useGameStore,
	useUiStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useIsMobile } from "../hooks/use-is-mobile";

// ── Color helpers ──

function parseHex(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [
		Number.parseInt(h.slice(0, 2), 16),
		Number.parseInt(h.slice(2, 4), 16),
		Number.parseInt(h.slice(4, 6), 16),
	];
}

function isLightColor(hex: string): boolean {
	const [r, g, b] = parseHex(hex);
	// Relative luminance approximation
	return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function lighten(hex: string, amount: number): string {
	const [r, g, b] = parseHex(hex);
	const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
	return `#${[r, g, b]
		.map((c) =>
			clamp(c + (255 - c) * amount)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

// ── Node types ──

const nodeTypes = { techNode: TechNodeComponent };

// ── Build React Flow data from game state ──

function buildFlowNodes(
	techNodes: TechNode[],
	ownedTechNodes: Record<string, number>,
	loc: number,
	cash: number,
	nodeTheme: TechNodeTheme,
): Node[] {
	const nodes: Node[] = [];
	for (const n of techNodes) {
		const owned = ownedTechNodes[n.id] ?? 0;
		const maxed = owned >= n.max;
		const prereqsMet =
			n.requires.length === 0 ||
			n.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);

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
			data: { ...n, state, owned, nodeTheme },
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
	_ownedTechNodes: Record<string, number>,
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
	_tx: number,
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
	_color: string,
): Array<{ d: string; strokeWidth: number; opacity: number }> {
	const bySource = new Map<string, EdgeDef[]>();
	for (const e of edges) {
		const group = bySource.get(e.sourceId) ?? [];
		group.push(e);
		bySource.set(e.sourceId, group);
	}

	const paths: Array<{ d: string; strokeWidth: number; opacity: number }> = [];

	for (const [, group] of bySource) {
		if (group.length === 0) continue;
		const sx = group[0].sx;
		const sy = group[0].sy;

		if (group.length === 1) {
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
			const sorted = [...group].sort((a, b) => a.tx - b.tx);
			const minTy = Math.min(...sorted.map((e) => e.ty));
			const junctionY = sy + (minTy - sy) * 0.5;

			paths.push({
				d: `M ${sx} ${sy} L ${sx} ${junctionY}`,
				strokeWidth: 2.5,
				opacity: 0.35,
			});

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
				width: "100%",
				height: "100%",
				overflow: "visible",
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
}

function NodePopover({ node }: PopoverProps) {
	const { t } = useTranslation();
	const { t: tTech } = useTranslation("tech-tree");
	const theme = useIdeTheme();
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const viewport = useViewport();

	const owned = ownedTechNodes[node.id] ?? 0;
	const maxed = owned >= node.max;
	const prereqsMet = node.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0);
	const cost = getTechNodeCost(node, owned);
	const useLoc = node.currency === "loc";
	const canAfford = useLoc ? loc >= cost : cash >= cost;
	const levelLabel = node.levelLabels?.[owned];

	const x = ((node.x ?? 0) + TECH_NODE_WIDTH) * viewport.zoom + viewport.x + 12;
	const y = (node.y ?? 0) * viewport.zoom + viewport.y;

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
				{node.icon} {tTech(`${node.id}.name`)}
			</div>
			<div css={popoverDescStyle}>{tTech(`${node.id}.description`)}</div>
			{node.effects.length > 0 && (
				<div css={popoverDetailStyle}>
					{node.effects.map((e) => formatEffect(e)).join(", ")}
				</div>
			)}
			{levelLabel && !maxed && <div css={popoverDetailStyle}>{levelLabel}</div>}
			{node.max > 1 && (
				<div css={popoverDetailStyle}>
					{t("tech_tree.level", { owned, max: node.max })}
				</div>
			)}
			{!maxed && (
				<div css={popoverDetailStyle}>
					{useLoc
						? t("tech_tree.cost_loc", { cost: formatNumber(cost) })
						: t("tech_tree.cost_cash", { cost: formatNumber(cost) })}
				</div>
			)}
			{!prereqsMet && !maxed && (
				<div css={[popoverDetailStyle, { color: "#e94560" }]}>
					{t("tech_tree.requires", {
						nodes: node.requires
							.filter((id) => (ownedTechNodes[id] ?? 0) === 0)
							.map((id) =>
								tTech(`${id}.name`, {
									defaultValue:
										allTechNodes.find((n) => n.id === id)?.name ?? id,
								}),
							)
							.join(", "),
					})}
				</div>
			)}
			{maxed && (
				<div css={{ fontSize: 12, color: theme.success, fontWeight: "bold" }}>
					{node.max === 1 ? t("tech_tree.researched") : t("tech_tree.maxed")}
				</div>
			)}
			{!maxed && prereqsMet && canAfford && (
				<div css={{ fontSize: 11, color: theme.accent, marginTop: 4 }}>
					{t("tech_tree.click_to_research")}
				</div>
			)}
			{!maxed && prereqsMet && !canAfford && (
				<div css={{ fontSize: 11, color: "#e94560", marginTop: 4 }}>
					{useLoc
						? t("tech_tree.not_enough_loc")
						: t("tech_tree.not_enough_cash")}
				</div>
			)}
			{!maxed && !prereqsMet && (
				<div css={{ fontSize: 11, color: theme.lineNumbers, marginTop: 4 }}>
					{t("tech_tree.locked")}
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

	const lastBuild = useRef(0);
	const cachedNodes = useRef<Node[]>([]);
	const prevOwned = useRef(ownedTechNodes);

	const nodeTheme = useMemo((): TechNodeTheme => {
		// Detect light theme: if background luminance is high, cards should be
		// lighter (white-ish); if dark, cards should be slightly lighter than bg.
		const bg = theme.background;
		const isLight = isLightColor(bg);
		return {
			nodeBg: isLight ? lighten(bg, 0.5) : lighten(bg, 0.08),
			nodeBgLocked: isLight ? theme.sidebarBg : theme.background,
			nodeBorder: theme.border,
			nameColor: theme.foreground,
			effectColor: theme.success,
			badgeColor: theme.textMuted,
		};
	}, [theme]);

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
				nodeTheme,
			);
		}
		return cachedNodes.current;
	}, [ownedTechNodes, loc, cash, nodeTheme]);

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

	const [hovered, setHovered] = useState<TechNode | null>(null);
	const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleNodeClick = useCallback(
		(_e: React.MouseEvent, node: Node) => {
			const techNode = allTechNodes.find((n) => n.id === node.id);
			if (!techNode) return;
			const owned = ownedTechNodes[techNode.id] ?? 0;
			const maxed = owned >= techNode.max;
			const cost = getTechNodeCost(techNode, owned);
			const useLoc = techNode.currency === "loc";
			const canAfford = useLoc ? loc >= cost : cash >= cost;

			if (!maxed && canAfford) {
				researchNode(techNode);
				// Flash the node for tactile feedback
				const el = document.querySelector(
					`[data-id="${node.id}"]`,
				) as HTMLElement | null;
				if (el) {
					el.style.transform = "scale(0.95)";
					el.style.boxShadow = "0 0 12px rgba(63, 185, 80, 0.5)";
					setTimeout(() => {
						el.style.transform = "";
						el.style.boxShadow = "";
					}, 50);
				}
				if (isMobile) setHovered(null);
			} else if (isMobile) {
				setHovered(techNode);
			}
		},
		[ownedTechNodes, loc, cash, researchNode, isMobile],
	);

	const handleNodeMouseEnter = useCallback(
		(_e: React.MouseEvent, node: Node) => {
			clearTimeout(leaveTimer.current);
			const techNode = allTechNodes.find((n) => n.id === node.id);
			if (techNode) {
				setHovered(techNode);
			}
		},
		[],
	);

	const handleNodeMouseLeave = useCallback(() => {
		leaveTimer.current = setTimeout(() => setHovered(null), 100);
	}, []);

	const containerDynamicCss = css({
		background: theme.background,
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
				{hovered && <NodePopover node={hovered} />}
			</ReactFlow>
		</div>
	);
}
