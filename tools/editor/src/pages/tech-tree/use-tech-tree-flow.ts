import { useCallback, useMemo, useState } from "react";
import {
	type Edge,
	type Node,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
	applyEdgeChanges,
	applyNodeChanges,
} from "@xyflow/react";
import type { TechNode } from "./types";

interface UseTechTreeFlowParams {
	nodes: TechNode[];
	onUpdate: (nodes: TechNode[]) => void;
}

function toFlowNodes(nodes: TechNode[]): Node[] {
	return nodes.map((n) => ({
		id: n.id,
		type: "techNode",
		position: { x: n.x ?? 0, y: n.y ?? 0 },
		data: { ...n },
	}));
}

function toFlowEdges(nodes: TechNode[]): Edge[] {
	const edges: Edge[] = [];
	for (const node of nodes) {
		for (const req of node.requires ?? []) {
			edges.push({
				id: `${req}->${node.id}`,
				source: req,
				target: node.id,
			});
		}
	}
	return edges;
}

export function useTechTreeFlow({ nodes, onUpdate }: UseTechTreeFlowParams) {
	const [flowNodes, setFlowNodes] = useState<Node[]>(() => toFlowNodes(nodes));
	const [flowEdges, setFlowEdges] = useState<Edge[]>(() => toFlowEdges(nodes));

	useMemo(() => {
		setFlowNodes(toFlowNodes(nodes));
		setFlowEdges(toFlowEdges(nodes));
	}, [nodes]);

	const onNodesChange: OnNodesChange = useCallback(
		(changes) => {
			setFlowNodes((prev) => applyNodeChanges(changes, prev));

			const positionChanges = changes.filter(
				(c) => c.type === "position" && c.dragging === false && c.position,
			);
			if (positionChanges.length > 0) {
				const updated = [...nodes];
				for (const change of positionChanges) {
					if (change.type !== "position" || !change.position) continue;
					const idx = updated.findIndex((n) => n.id === change.id);
					if (idx >= 0) {
						updated[idx] = {
							...updated[idx],
							x: Math.round(change.position.x),
							y: Math.round(change.position.y),
						};
					}
				}
				onUpdate(updated);
			}
		},
		[nodes, onUpdate],
	);

	const onEdgesChange: OnEdgesChange = useCallback(
		(changes) => {
			setFlowEdges((prev) => applyEdgeChanges(changes, prev));

			const removals = changes.filter((c) => c.type === "remove");
			if (removals.length > 0) {
				const removedIds = new Set(
					removals.map((c) => (c.type === "remove" ? c.id : "")),
				);
				const updated = nodes.map((node) => ({
					...node,
					requires: (node.requires ?? []).filter(
						(req) => !removedIds.has(`${req}->${node.id}`),
					),
				}));
				onUpdate(updated);
			}
		},
		[nodes, onUpdate],
	);

	const onConnect: OnConnect = useCallback(
		(connection) => {
			const { source, target } = connection;
			if (!source || !target) return;
			const updated = nodes.map((node) => {
				if (node.id === target && !(node.requires ?? []).includes(source)) {
					return { ...node, requires: [...(node.requires ?? []), source] };
				}
				return node;
			});
			onUpdate(updated);
		},
		[nodes, onUpdate],
	);

	return { flowNodes, flowEdges, onNodesChange, onEdgesChange, onConnect };
}
