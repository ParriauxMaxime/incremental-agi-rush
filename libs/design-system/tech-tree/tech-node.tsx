import { css } from "@emotion/react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { match } from "ts-pattern";
import { NodeStateEnum } from "./types";

function getCurrencyColor(currency: string): string {
	return match(currency)
		.with("cash", () => "#6272a4")
		.with("loc", () => "#8be9fd")
		.with("flops", () => "#c678dd")
		.otherwise(() => "#8892b0");
}

function getStateStyle(
	state: NodeStateEnum | undefined,
	currency: string,
	selected: boolean,
): { borderColor: string; opacity: number; cursor: string } {
	if (!state) {
		// Editor mode — border by currency, full opacity
		return {
			borderColor: selected ? "#ffffff" : getCurrencyColor(currency),
			opacity: 1,
			cursor: "grab",
		};
	}
	return match(state)
		.with(NodeStateEnum.locked, () => ({
			borderColor: "#1e2630",
			opacity: 0.4,
			cursor: "default",
		}))
		.with(NodeStateEnum.visible, () => ({
			borderColor: "#1e2630",
			opacity: 0.6,
			cursor: "default",
		}))
		.with(NodeStateEnum.affordable, () => ({
			borderColor: "#58a6ff",
			opacity: 1,
			cursor: "pointer",
		}))
		.with(NodeStateEnum.owned, () => ({
			borderColor: "#3fb950",
			opacity: 0.8,
			cursor: "default",
		}))
		.exhaustive();
}

function getSubtitle(node: Record<string, unknown>): string {
	const state = node.state as NodeStateEnum | undefined;
	const owned = node.owned as number | undefined;
	const max = node.max as number | undefined;

	if (state && owned !== undefined && max !== undefined) {
		if (owned >= max) return max === 1 ? "Researched" : `${owned}/${max}`;
		return `${owned}/${max}`;
	}
	// Editor mode — show base cost
	const currency = (node.currency as string) ?? "cash";
	return `${node.baseCost as number} ${currency}`;
}

const rowStyle = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
});

const nameStyle = css({
	color: "#ccd6f6",
	fontSize: 13,
	fontWeight: 600,
	whiteSpace: "nowrap",
});

const subtitleStyle = css({
	color: "#8892b0",
	fontSize: 11,
	marginTop: 2,
});

export function TechNodeComponent({ data, selected }: NodeProps) {
	const node = data as Record<string, unknown>;
	const currency = (node.currency as string) ?? "cash";
	const state = node.state as NodeStateEnum | undefined;
	const style = getStateStyle(state, currency, selected ?? false);

	return (
		<div
			css={css({
				background: "#16213e",
				border: `2px solid ${style.borderColor}`,
				borderRadius: 8,
				padding: "8px 12px",
				minWidth: 140,
				cursor: style.cursor,
				opacity: style.opacity,
				transition: "opacity 0.2s, border-color 0.2s",
			})}
		>
			<Handle type="target" position={Position.Top} />
			<div css={rowStyle}>
				<span>{node.icon as string}</span>
				<span css={nameStyle}>{node.name as string}</span>
			</div>
			<div css={subtitleStyle}>{getSubtitle(node)}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
