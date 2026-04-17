import { css } from "@emotion/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { match } from "ts-pattern";
import type { TechNodeEffect } from "./types";
import { NodeStateEnum } from "./types";

function getCurrencyColor(currency: string): string {
	return match(currency)
		.with("cash", () => "#f0b232")
		.with("loc", () => "#8be9fd")
		.with("flops", () => "#c678dd")
		.otherwise(() => "#8892b0");
}

export interface TechNodeTheme {
	nodeBg: string; // default card background
	nodeBgLocked: string; // locked state background
	nodeBorder: string; // default/inactive border
	nameColor: string; // node name text
	effectColor: string; // effect text (green-ish)
	badgeColor: string; // owned badge text
}

interface StateStyle {
	borderColor: string;
	opacity: number;
	cursor: string;
	background: string;
	filter: string;
}

function getStateStyle(
	state: NodeStateEnum | undefined,
	currency: string,
	selected: boolean,
	nodeTheme: TechNodeTheme | undefined,
): StateStyle {
	const defaultBg = nodeTheme ? nodeTheme.nodeBg : "#16213e";
	const defaults = { background: defaultBg, filter: "none" };
	if (!state) {
		// Editor mode — border by currency, full opacity
		return {
			...defaults,
			borderColor: selected ? "#ffffff" : getCurrencyColor(currency),
			opacity: 1,
			cursor: "grab",
		};
	}
	return match(state)
		.with(NodeStateEnum.locked, () => ({
			borderColor: nodeTheme ? nodeTheme.nodeBorder : "#1e2630",
			opacity: 1,
			cursor: "default",
			background: nodeTheme ? nodeTheme.nodeBgLocked : "#0d1220",
			filter: "saturate(0.2) brightness(0.5)",
		}))
		.with(NodeStateEnum.visible, () => ({
			borderColor: nodeTheme ? nodeTheme.nodeBorder : "#1e2630",
			opacity: 1,
			cursor: "default",
			background: nodeTheme ? nodeTheme.nodeBg : "#111a2e",
			filter: "none",
		}))
		.with(NodeStateEnum.affordable, () => ({
			...defaults,
			borderColor: "#58a6ff",
			opacity: 1,
			cursor: "pointer",
		}))
		.with(NodeStateEnum.owned, () => ({
			...defaults,
			borderColor: "#3fb950",
			opacity: 1,
			cursor: "default",
		}))
		.exhaustive();
}

// ── Unit formatting ──

const effectLabels: Record<string, { unit: string; prefix?: string }> = {
	locPerKey: { unit: "LoC/key" },
	flops: { unit: "FLOPS" },
	cashMultiplier: { unit: "$/LoC" },
	locProductionSpeed: { unit: "LoC speed" },
	managerMultiplier: { unit: "mgr bonus" },
	internLocMultiplier: { unit: "intern LoC" },
	devLocMultiplier: { unit: "dev LoC" },
	teamLocMultiplier: { unit: "team LoC" },
	llmLocMultiplier: { unit: "LLM LoC" },
	agentLocMultiplier: { unit: "agent LoC" },
	freelancerLocMultiplier: { unit: "freelancer LoC" },
	internCostDiscount: { unit: "intern cost" },
	devCostDiscount: { unit: "dev cost" },
	teamCostDiscount: { unit: "team cost" },
	llmCostDiscount: { unit: "LLM cost" },
	agentCostDiscount: { unit: "agent cost" },
	freelancerCostDiscount: { unit: "freelancer cost" },
	managerCostDiscount: { unit: "mgr cost" },
	internMaxBonus: { unit: "max interns" },
	teamMaxBonus: { unit: "max teams" },
	managerMaxBonus: { unit: "max mgrs" },
	llmMaxBonus: { unit: "max LLMs" },
	agentMaxBonus: { unit: "max agents" },
	freelancerMaxBonus: { unit: "max freelancers" },
};

export function formatEffect(effect: TechNodeEffect): string {
	return match(effect.op)
		.with("enable", () => {
			if (effect.type === "autoType") return "Auto-type";
			if (effect.type === "modelUnlock")
				return `${String(effect.value).replace(/_/g, " ").toUpperCase()}`;
			return `${effect.type}`;
		})
		.with("set", () => {
			if (effect.type === "tierUnlock") return `Tier ${effect.value}`;
			return `${effect.type} = ${effect.value}`;
		})
		.with("add", () => {
			const label = effectLabels[effect.type];
			const prefix = label?.prefix ? `${label.prefix} ` : "";
			const unit = label?.unit ?? effect.type;
			return `+${formatCompact(effect.value as number)} ${prefix}${unit}`;
		})
		.with("multiply", () => {
			const label = effectLabels[effect.type];
			const unit = label?.unit ?? effect.type;
			return `×${effect.value} ${unit}`;
		})
		.otherwise(() => `${effect.type}: ${effect.value}`);
}

function formatCost(baseCost: number, currency: string): string {
	if (currency === "cash") return `$${formatCompact(baseCost)}`;
	return `${formatCompact(baseCost)} LoC`;
}

function formatCompact(n: number): string {
	if (n >= 1e12) return `${+(n / 1e12).toPrecision(3)}T`;
	if (n >= 1e9) return `${+(n / 1e9).toPrecision(3)}B`;
	if (n >= 1e6) return `${+(n / 1e6).toPrecision(3)}M`;
	if (n >= 1e3) return `${+(n / 1e3).toPrecision(3)}K`;
	return String(n);
}

// ── Styles ──

const topSectionCss = css({
	display: "flex",
	gap: 6,
	alignItems: "flex-start",
});

const iconCss = css({
	fontSize: 16,
	lineHeight: 1,
	flexShrink: 0,
});

const priceCss = css({
	position: "absolute",
	bottom: 5,
	right: 8,
	fontSize: 14,
	fontWeight: 700,
});

export const TECH_NODE_WIDTH = 150;
export const TECH_NODE_HEIGHT = 72;

export function TechNodeComponent({ data, selected }: NodeProps) {
	const node = data as Record<string, unknown>;
	const name = node.name as string;
	const currency = (node.currency as string) ?? "cash";
	const baseCost = node.baseCost as number;
	const costMultiplier = (node.costMultiplier as number) ?? 1;
	const effects = (node.effects as TechNodeEffect[]) ?? [];
	const max = node.max as number;
	const state = node.state as NodeStateEnum | undefined;
	const owned = (node.owned as number | undefined) ?? 0;
	const nodeTheme = node.nodeTheme as TechNodeTheme | undefined;
	const style = getStateStyle(state, currency, selected ?? false, nodeTheme);
	const maxed = state ? owned >= max : false;
	const displayCost = Math.floor(baseCost * costMultiplier ** owned);

	const primaryEffect = effects.find(
		(e) => e.type !== "modelUnlock" && e.type !== "cashMultiplier",
	);
	const effectText = primaryEffect
		? formatEffect(primaryEffect)
		: effects[0]
			? formatEffect(effects[0])
			: "";

	const nameColor = nodeTheme ? nodeTheme.nameColor : "#ccd6f6";
	const effectColor = nodeTheme ? nodeTheme.effectColor : "#7ee787";
	const badgeColor = nodeTheme ? nodeTheme.badgeColor : "#8892b0";

	return (
		<div
			css={css({
				background: style.background,
				border: `2px solid ${style.borderColor}`,
				borderRadius: 8,
				padding: "6px 8px",
				width: TECH_NODE_WIDTH,
				height: TECH_NODE_HEIGHT,
				boxSizing: "border-box",
				overflow: "hidden",
				cursor: style.cursor,
				opacity: style.opacity,
				filter: style.filter,
				transition:
					"opacity 0.2s, border-color 0.2s, filter 0.2s, box-shadow 0.2s",
				position: "relative",
				boxShadow: `0 1px 3px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.04)`,
			})}
		>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Bottom} id="bottom" />
			<Handle type="target" position={Position.Left} id="left" />
			<Handle type="target" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Top} id="top" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
			<Handle type="source" position={Position.Left} id="left" />
			<Handle type="source" position={Position.Right} id="right" />
			{state && max > 1 && (
				<span
					style={{
						position: "absolute",
						top: 3,
						right: 6,
						color: badgeColor,
						fontSize: 9,
					}}
				>
					{owned}/{max}
				</span>
			)}
			<div css={topSectionCss}>
				<div css={iconCss}>{node.icon as string}</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div
						style={{
							color: nameColor,
							fontSize: 12,
							fontWeight: 600,
							lineHeight: 1.2,
							wordBreak: "break-word",
						}}
					>
						{name}
					</div>
					{effectText && (
						<div
							style={{
								color: effectColor,
								fontSize: 10,
								lineHeight: 1.2,
								marginTop: 2,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{effectText}
						</div>
					)}
				</div>
			</div>
			{maxed ? (
				<span css={[priceCss, css({ color: "#3fb950", fontSize: 12 })]}>
					{max === 1 ? "Researched" : "Maxed"}
				</span>
			) : (
				<span css={[priceCss, css({ color: getCurrencyColor(currency) })]}>
					{formatCost(displayCost, currency)}
				</span>
			)}
		</div>
	);
}
