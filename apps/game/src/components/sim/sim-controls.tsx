import { css } from "@emotion/react";
import { AiStrategyEnum, type SimConfig } from "@flopsed/engine";
import { useState } from "react";

const controlsCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 16,
	display: "flex",
	gap: 24,
	alignItems: "flex-end",
	flexWrap: "wrap",
	marginBottom: 16,
});

const groupCss = css({
	display: "flex",
	flexDirection: "column",
	gap: 4,
});

const labelCss = css({
	fontSize: 11,
	color: "#6272a4",
	textTransform: "uppercase",
	letterSpacing: 0.5,
});

const inputCss = css({
	background: "#0d1117",
	border: "1px solid #1e2630",
	color: "#c5c8c6",
	padding: "6px 10px",
	borderRadius: 4,
	fontFamily: "inherit",
	fontSize: 13,
	width: 140,
});

const btnCss = css({
	background: "#238636",
	color: "#fff",
	border: "none",
	padding: "8px 20px",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "inherit",
	fontSize: 13,
	fontWeight: "bold",
	"&:hover": { background: "#2ea043" },
	"&:disabled": { opacity: 0.5, cursor: "default" },
});

interface SimControlsProps {
	onRun: (config: SimConfig) => void;
	running: boolean;
}

export function SimControls({ onRun, running }: SimControlsProps) {
	const [keysPerSec, setKeysPerSec] = useState(6);
	const [skill, setSkill] = useState(0.8);
	const [aiStrategy, setAiStrategy] = useState<AiStrategyEnum>(
		AiStrategyEnum.greedy,
	);
	const [maxMinutes, setMaxMinutes] = useState(60);

	return (
		<div css={controlsCss}>
			<div css={groupCss}>
				<label css={labelCss} htmlFor="sim-keys">
					Typing Speed
				</label>
				<input
					id="sim-keys"
					css={inputCss}
					type="number"
					min={1}
					max={20}
					value={keysPerSec}
					onChange={(e) => setKeysPerSec(Number(e.target.value))}
				/>
				<span css={[labelCss, { fontSize: 10 }]}>keys/sec (avg: 5-8)</span>
			</div>
			<div css={groupCss}>
				<label css={labelCss} htmlFor="sim-skill">
					Purchase Skill
				</label>
				<select
					id="sim-skill"
					css={inputCss}
					value={skill}
					onChange={(e) => setSkill(Number(e.target.value))}
				>
					<option value={0.6}>Casual (60%)</option>
					<option value={0.8}>Average (80%)</option>
					<option value={0.95}>Minmaxer (95%)</option>
				</select>
			</div>
			<div css={groupCss}>
				<label css={labelCss} htmlFor="sim-ai">
					AI Strategy
				</label>
				<select
					id="sim-ai"
					css={inputCss}
					value={aiStrategy}
					onChange={(e) => setAiStrategy(e.target.value as AiStrategyEnum)}
				>
					<option value={AiStrategyEnum.greedy}>Greedy</option>
					<option value={AiStrategyEnum.balanced}>Balanced</option>
					<option value={AiStrategyEnum.exec_heavy}>Exec Heavy</option>
					<option value={AiStrategyEnum.ai_heavy}>AI Heavy</option>
				</select>
			</div>
			<div css={groupCss}>
				<label css={labelCss} htmlFor="sim-time">
					Max Time
				</label>
				<input
					id="sim-time"
					css={inputCss}
					type="number"
					min={10}
					max={120}
					step={5}
					value={maxMinutes}
					onChange={(e) => setMaxMinutes(Number(e.target.value))}
				/>
				<span css={[labelCss, { fontSize: 10 }]}>minutes</span>
			</div>
			<button
				css={btnCss}
				type="button"
				disabled={running}
				onClick={() => onRun({ keysPerSec, skill, aiStrategy, maxMinutes })}
			>
				{running ? "Simulating..." : "Run Simulation"}
			</button>
		</div>
	);
}
