import { css } from "@emotion/react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { match } from "ts-pattern";

const TierColorEnum = {
	garage: "#6272a4",
	freelancing: "#8be9fd",
	startup: "#3fb950",
	tech_company: "#d19a66",
	ai_lab: "#c678dd",
	agi_race: "#e94560",
} as const;

type TierKey = keyof typeof TierColorEnum;

function getTierColor(currency: string): string {
	return match(currency)
		.with("cash", () => TierColorEnum.garage)
		.with("loc", () => TierColorEnum.freelancing)
		.with("flops", () => TierColorEnum.ai_lab)
		.otherwise(() => "#8892b0");
}

const nodeStyle = (borderColor: string, selected: boolean) => css`
	background: #16213e;
	border: 2px solid ${selected ? "#ffffff" : borderColor};
	border-radius: 8px;
	padding: 8px 12px;
	min-width: 140px;
	cursor: grab;
`;

const rowStyle = css`
	display: flex;
	align-items: center;
	gap: 6px;
`;

const nameStyle = css`
	color: #ccd6f6;
	font-size: 13px;
	font-weight: 600;
	white-space: nowrap;
`;

const costStyle = css`
	color: #8892b0;
	font-size: 11px;
	margin-top: 2px;
`;

export function TechNodeComponent({ data, selected }: NodeProps) {
	const node = data as Record<string, unknown>;
	const currency = (node.currency as string) ?? "cash";
	const borderColor = getTierColor(currency);

	return (
		<div css={nodeStyle(borderColor, selected ?? false)}>
			<Handle type="target" position={Position.Top} />
			<div css={rowStyle}>
				<span>{node.icon as string}</span>
				<span css={nameStyle}>{node.name as string}</span>
			</div>
			<div css={costStyle}>
				{node.baseCost as number} {currency}
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
