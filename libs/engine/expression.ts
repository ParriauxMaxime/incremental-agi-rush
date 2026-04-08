import type { ExpressionContext } from "@flopsed/domain";

/**
 * Resolve simple expressions like "currentCash * 0.02" or "currentLocPerSec * 0.8".
 * Only supports: variable, variable * constant, variable + constant, variable - constant.
 * No nested expressions or parentheses needed -- data only uses simple patterns.
 */
export function resolveExpression(
	expr: string | number,
	ctx: ExpressionContext,
): number {
	if (typeof expr === "number") return expr;

	const trimmed = expr.trim();

	// Try pure number
	const asNum = Number(trimmed);
	if (!Number.isNaN(asNum)) return asNum;

	// Try "variable * constant" or "variable + constant" etc.
	const m = trimmed.match(/^(\w+)\s*([+\-*/])\s*([0-9.]+)$/);
	if (m) {
		const variable = lookupVariable(m[1], ctx);
		const op = m[2];
		const constant = Number(m[3]);
		if (op === "*") return variable * constant;
		if (op === "+") return variable + constant;
		if (op === "-") return variable - constant;
		if (op === "/") return constant !== 0 ? variable / constant : 0;
	}

	// Try "constant + variable * constant" (e.g. "20 + currentTierIndex * 40")
	const m2 = trimmed.match(/^([0-9.]+)\s*\+\s*(\w+)\s*\*\s*([0-9.]+)$/);
	if (m2) {
		const base = Number(m2[1]);
		const variable = lookupVariable(m2[2], ctx);
		const scale = Number(m2[3]);
		return base + variable * scale;
	}

	// Try bare variable name
	return lookupVariable(trimmed, ctx);
}

function lookupVariable(name: string, ctx: ExpressionContext): number {
	if (name === "currentCash") return ctx.currentCash;
	if (name === "currentLoc") return ctx.currentLoc;
	if (name === "currentLocPerSec") return ctx.currentLocPerSec;
	if (name === "currentTierIndex") return ctx.currentTierIndex;
	return 0;
}
