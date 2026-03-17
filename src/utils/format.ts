export function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format a number with 3 significant figures at each magnitude tier.
 * This ensures the display always ticks visibly, even at high values.
 *
 *   1,234     → "1.23K"
 *   12,345    → "12.3K"
 *   123,456   → "123K"
 *   1,234,567 → "1.23M"
 */
export function formatNumber(n: number, decimals = false): string {
	if (n >= 1e12) return formatTier(n, 1e12, "T");
	if (n >= 1e9) return formatTier(n, 1e9, "B");
	if (n >= 1e6) return formatTier(n, 1e6, "M");
	if (n >= 1e3) return formatTier(n, 1e3, "K");
	if (decimals && n > 0 && n < 100) return n.toFixed(2);
	return Math.floor(n).toString();
}

function formatTier(n: number, div: number, suffix: string): string {
	const scaled = n / div;
	if (scaled >= 100) return `${Math.floor(scaled)}${suffix}`;
	if (scaled >= 10) return `${scaled.toFixed(1)}${suffix}`;
	return `${scaled.toFixed(2)}${suffix}`;
}
