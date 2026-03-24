import { css } from "@emotion/react";
import type { BalanceCheckResult } from "../../api/client";

const preCss = (passed: boolean) =>
	css({
		background: "#0d1117",
		border: `1px solid ${passed ? "#3fb950" : "#e94560"}`,
		borderRadius: 6,
		padding: 16,
		color: passed ? "#3fb950" : "#e94560",
		fontSize: 12,
		fontFamily: "'Fira Code', 'Cascadia Code', monospace",
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
		maxHeight: 400,
		overflow: "auto",
	});

const titleCss = css({
	color: "#c678dd",
	fontSize: 14,
	fontWeight: "bold",
	margin: "20px 0 8px",
});

interface CliOutputProps {
	result: BalanceCheckResult;
}

export function CliOutput({ result }: CliOutputProps) {
	const passed = result.exitCode === 0;
	return (
		<div>
			<div css={titleCss}>CLI Balance Check</div>
			<pre css={preCss(passed)}>
				{result.stdout}
				{result.stderr && `\n${result.stderr}`}
			</pre>
		</div>
	);
}
