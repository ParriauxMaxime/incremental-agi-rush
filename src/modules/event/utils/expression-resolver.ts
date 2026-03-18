import type { ExpressionContext } from "../types";

/**
 * Resolve simple expressions like "currentCash * 0.02" or "currentLocPerSec * 0.8".
 * Only supports: variable, variable * constant, variable + constant, variable - constant.
 * No nested expressions or parentheses needed — data only uses simple patterns.
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
	const match = trimmed.match(/^(\w+)\s*([+\-*/])\s*([0-9.]+)$/);
	if (match) {
		const variable = lookupVariable(match[1], ctx);
		const op = match[2];
		const constant = Number(match[3]);
		if (op === "*") return variable * constant;
		if (op === "+") return variable + constant;
		if (op === "-") return variable - constant;
		if (op === "/") return constant !== 0 ? variable / constant : 0;
	}

	// Try bare variable name
	return lookupVariable(trimmed, ctx);
}

function lookupVariable(name: string, ctx: ExpressionContext): number {
	if (name === "currentCash") return ctx.currentCash;
	if (name === "currentLoc") return ctx.currentLoc;
	if (name === "currentLocPerSec") return ctx.currentLocPerSec;
	return 0;
}
