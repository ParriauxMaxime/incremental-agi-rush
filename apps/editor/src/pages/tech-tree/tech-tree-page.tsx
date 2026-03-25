import { css } from "@emotion/react";
import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	type TechTreeNode as TechNode,
	TechNodeComponent,
	useTechTreeFlow,
} from "@agi-rush/design-system";
import Dagre from "@dagrejs/dagre";
import { useCallback, useMemo, useState } from "react";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useTechTreeStore } from "../../store/data-store";
import { NodeInspector } from "./node-inspector";

const nodeTypes = { techNode: TechNodeComponent };

const layoutStyle = css`
	display: flex;
	flex: 1;
	min-height: 0;
	height: calc(100vh - 120px);
`;

const canvasStyle = css`
	flex: 1;
	position: relative;
`;

const toolbarStyle = css`
	position: absolute;
	top: 10px;
	left: 10px;
	z-index: 5;
	display: flex;
	gap: 8px;
`;

const toolBtnStyle = css`
	background: #2a2a4a;
	color: #64ffda;
	border: none;
	border-radius: 6px;
	padding: 6px 14px;
	cursor: pointer;
	font-size: 13px;
	font-weight: 500;
	&:hover { background: #3a3a5a; }
`;

function layoutWithDagre(nodes: TechNode[]): TechNode[] {
	const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });
	for (const n of nodes) {
		g.setNode(n.id, { width: 140, height: 56 });
		for (const req of n.requires ?? []) {
			g.setEdge(req, n.id);
		}
	}
	Dagre.layout(g);
	return nodes.map((n) => {
		const pos = g.node(n.id);
		return { ...n, x: Math.round(pos.x), y: Math.round(pos.y) };
	});
}

function makeDefaultNode(): TechNode {
	return {
		id: `new_node_${Date.now()}`,
		name: "New Node",
		description: "",
		icon: "🔧",
		requires: [],
		max: 1,
		baseCost: 10,
		costMultiplier: 1,
		currency: "cash",
		effects: [],
		x: 100,
		y: 100,
	};
}

export function TechTreePage() {
	const store = useTechTreeStore();
	const nodes = useMemo(
		() => (store.data?.nodes ?? []) as TechNode[],
		[store.data],
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const updateNodes = useCallback(
		(updated: TechNode[]) => {
			store.update({ ...store.data, nodes: updated });
		},
		[store.update, store.data],
	);

	const { flowNodes, flowEdges, onNodesChange, onEdgesChange, onConnect } =
		useTechTreeFlow({ nodes, onUpdate: updateNodes });

	const allNodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
	const selectedNode = useMemo(
		() =>
			selectedId ? (nodes.find((n) => n.id === selectedId) ?? null) : null,
		[selectedId, nodes],
	);

	const handleAdd = useCallback(() => {
		updateNodes([...nodes, makeDefaultNode()]);
	}, [nodes, updateNodes]);

	const handleRelayout = useCallback(() => {
		updateNodes(layoutWithDagre(nodes));
	}, [nodes, updateNodes]);

	const handleNodeChange = useCallback(
		(updated: TechNode) => {
			const next = nodes.map((n) => (n.id === selectedId ? updated : n));
			updateNodes(next);
			if (updated.id !== selectedId) {
				setSelectedId(updated.id);
			}
		},
		[nodes, selectedId, updateNodes],
	);

	const handleNodeDelete = useCallback(() => {
		const next = nodes
			.filter((n) => n.id !== selectedId)
			.map((n) => ({
				...n,
				requires: (n.requires ?? []).filter((r) => r !== selectedId),
			}));
		setSelectedId(null);
		updateNodes(next);
	}, [nodes, selectedId, updateNodes]);

	return (
		<PageWrapper
			title="Tech Tree"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			<div css={layoutStyle}>
				<div css={canvasStyle}>
					<div css={toolbarStyle}>
						<button type="button" css={toolBtnStyle} onClick={handleAdd}>
							+ Add Node
						</button>
						<button type="button" css={toolBtnStyle} onClick={handleRelayout}>
							Re-layout
						</button>
					</div>
					<ReactFlow
						nodes={flowNodes}
						edges={flowEdges}
						nodeTypes={nodeTypes}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						onNodeClick={(_e, node) => setSelectedId(node.id)}
						onPaneClick={() => setSelectedId(null)}
						snapToGrid
						snapGrid={[20, 20]}
						fitView
					>
						<Background gap={20} />
						<MiniMap />
						<Controls />
					</ReactFlow>
				</div>
				{selectedNode && (
					<NodeInspector
						node={selectedNode}
						allNodeIds={allNodeIds}
						onChange={handleNodeChange}
						onClose={() => setSelectedId(null)}
						onDelete={handleNodeDelete}
					/>
				)}
			</div>
		</PageWrapper>
	);
}
