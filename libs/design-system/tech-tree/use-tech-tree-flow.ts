import {
	applyEdgeChanges,
	applyNodeChanges,
	type Edge,
	type Node,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
} from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import { TECH_NODE_HEIGHT, TECH_NODE_WIDTH } from "./tech-node";
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

function getHandlePair(
	source: TechNode,
	target: TechNode,
): { sourceHandle: string; targetHandle: string } {
	const sx = (source.x ?? 0) + TECH_NODE_WIDTH / 2;
	const sy = (source.y ?? 0) + TECH_NODE_HEIGHT / 2;
	const tx = (target.x ?? 0) + TECH_NODE_WIDTH / 2;
	const ty = (target.y ?? 0) + TECH_NODE_HEIGHT / 2;
	const dx = tx - sx;
	const dy = ty - sy;

	if (Math.abs(dy) >= Math.abs(dx)) {
		return dy >= 0
			? { sourceHandle: "bottom", targetHandle: "top" }
			: { sourceHandle: "top", targetHandle: "bottom" };
	}
	return dx >= 0
		? { sourceHandle: "right", targetHandle: "left" }
		: { sourceHandle: "left", targetHandle: "right" };
}

function toFlowEdges(nodes: TechNode[]): Edge[] {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const edges: Edge[] = [];
	for (const node of nodes) {
		for (const req of node.requires ?? []) {
			const sourceNode = nodeMap.get(req);
			if (!sourceNode) continue;
			const { sourceHandle, targetHandle } = getHandlePair(sourceNode, node);
			edges.push({
				id: `${req}->${node.id}`,
				source: req,
				target: node.id,
				sourceHandle,
				targetHandle,
				type: "bezier",
			});
		}
	}
	return edges;
}

export function useTechTreeFlow({ nodes, onUpdate }: UseTechTreeFlowParams) {
	const [flowNodes, setFlowNodes] = useState<Node[]>(() => toFlowNodes(nodes));
	const [flowEdges, setFlowEdges] = useState<Edge[]>(() => toFlowEdges(nodes));

	useEffect(() => {
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
