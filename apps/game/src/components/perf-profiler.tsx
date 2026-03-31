import { css } from "@emotion/react";
import { useCallback, useRef, useState } from "react";

const overlayBase = css({
	position: "fixed",
	bottom: 8,
	right: 8,
	zIndex: 9999,
	fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
	fontSize: 11,
	lineHeight: 1.4,
	pointerEvents: "auto",
});

const panelCss = css({
	background: "rgba(0, 0, 0, 0.85)",
	border: "1px solid #333",
	borderRadius: 6,
	padding: "8px 10px",
	color: "#e0e0e0",
	minWidth: 220,
	backdropFilter: "blur(4px)",
});

const btnCss = css({
	padding: "4px 10px",
	fontSize: 11,
	fontFamily: "inherit",
	border: "1px solid #555",
	borderRadius: 4,
	cursor: "pointer",
	background: "#222",
	color: "#e0e0e0",
	"&:hover": { background: "#333" },
});

const startBtnCss = css([
	btnCss,
	{
		borderColor: "#4caf50",
		color: "#4caf50",
		"&:hover": { background: "#1b3a1b" },
	},
]);

const stopBtnCss = css([
	btnCss,
	{
		borderColor: "#f44336",
		color: "#f44336",
		"&:hover": { background: "#3a1b1b" },
	},
]);

interface PerfSnapshot {
	duration: string;
	totalFrames: number;
	fps: { avg: string; min: string; p1: string; p5: string };
	jank: { count: number; pct: string };
	longTasks: { count: number; totalBlockingTimeMs: string };
	layoutShifts: { total: number; cumulativeCLS: string };
	memory: { startMB: string; endMB: string; growthMB: string };
}

export function PerfProfiler() {
	const [recording, setRecording] = useState(false);
	const [result, setResult] = useState<PerfSnapshot | null>(null);
	const dataRef = useRef<{
		frames: { delta: number }[];
		startTime: number;
		rafId: number;
		longTaskObs: PerformanceObserver | null;
		clsObs: PerformanceObserver | null;
		longTasks: { duration: number }[];
		layoutShifts: { value: number }[];
		memStart: number;
	} | null>(null);

	const start = useCallback(() => {
		setResult(null);
		const data = {
			frames: [] as { delta: number }[],
			startTime: performance.now(),
			rafId: 0,
			longTaskObs: null as PerformanceObserver | null,
			clsObs: null as PerformanceObserver | null,
			longTasks: [] as { duration: number }[],
			layoutShifts: [] as { value: number }[],
			memStart:
				(performance as unknown as { memory?: { usedJSHeapSize: number } })
					.memory?.usedJSHeapSize ?? 0,
		};

		let lastFrame = performance.now();
		function trackFrame(now: number) {
			data.frames.push({ delta: now - lastFrame });
			lastFrame = now;
			data.rafId = requestAnimationFrame(trackFrame);
		}
		data.rafId = requestAnimationFrame(trackFrame);

		try {
			data.longTaskObs = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					data.longTasks.push({ duration: entry.duration });
				}
			});
			data.longTaskObs.observe({ type: "longtask", buffered: false });
		} catch {
			// longtask not supported
		}

		try {
			data.clsObs = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					data.layoutShifts.push({
						value: (entry as unknown as { value: number }).value,
					});
				}
			});
			data.clsObs.observe({ type: "layout-shift", buffered: false });
		} catch {
			// layout-shift not supported
		}

		dataRef.current = data;
		setRecording(true);
	}, []);

	const stop = useCallback(() => {
		const data = dataRef.current;
		if (!data) return;

		cancelAnimationFrame(data.rafId);
		data.longTaskObs?.disconnect();
		data.clsObs?.disconnect();

		const totalTime = performance.now() - data.startTime;
		const deltas = data.frames.map((f) => f.delta);
		const fps = deltas.map((dt) => 1000 / dt);
		const sorted = [...fps].sort((a, b) => a - b);
		const avgFps = fps.reduce((a, b) => a + b, 0) / (fps.length || 1);
		const p1 = sorted[Math.floor(sorted.length * 0.01)] ?? 0;
		const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
		const minFps = sorted[0] ?? 0;
		const jankFrames = deltas.filter((dt) => dt > 33.3);
		const totalBlockingTime = data.longTasks.reduce(
			(a, t) => a + Math.max(0, t.duration - 50),
			0,
		);
		const totalCLS = data.layoutShifts.reduce((a, s) => a + s.value, 0);
		const mem = (
			performance as unknown as { memory?: { usedJSHeapSize: number } }
		).memory;
		const memEnd = mem?.usedJSHeapSize ?? 0;

		setResult({
			duration: `${(totalTime / 1000).toFixed(1)}s`,
			totalFrames: data.frames.length,
			fps: {
				avg: avgFps.toFixed(1),
				min: minFps.toFixed(1),
				p1: p1.toFixed(1),
				p5: p5.toFixed(1),
			},
			jank: {
				count: jankFrames.length,
				pct: `${((jankFrames.length / (deltas.length || 1)) * 100).toFixed(1)}%`,
			},
			longTasks: {
				count: data.longTasks.length,
				totalBlockingTimeMs: totalBlockingTime.toFixed(0),
			},
			layoutShifts: {
				total: data.layoutShifts.length,
				cumulativeCLS: totalCLS.toFixed(4),
			},
			memory: {
				startMB: (data.memStart / 1024 / 1024).toFixed(1),
				endMB: (memEnd / 1024 / 1024).toFixed(1),
				growthMB: ((memEnd - data.memStart) / 1024 / 1024).toFixed(2),
			},
		});
		dataRef.current = null;
		setRecording(false);
	}, []);

	return (
		<div css={overlayBase}>
			<div css={panelCss}>
				<div
					css={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: result ? 6 : 0,
					}}
				>
					<span css={{ fontWeight: "bold", color: "#aaa" }}>PERF</span>
					{recording ? (
						<>
							<span css={{ color: "#f44336" }}>● REC</span>
							<button type="button" css={stopBtnCss} onClick={stop}>
								Stop
							</button>
						</>
					) : (
						<button type="button" css={startBtnCss} onClick={start}>
							Start
						</button>
					)}
				</div>
				{result && (
					<div
						css={{
							display: "grid",
							gridTemplateColumns: "auto 1fr",
							gap: "2px 8px",
						}}
					>
						<span css={{ color: "#888" }}>Duration</span>
						<span>
							{result.duration} ({result.totalFrames} frames)
						</span>
						<span css={{ color: "#888" }}>FPS avg</span>
						<span>{result.fps.avg}</span>
						<span css={{ color: "#888" }}>FPS p1/p5</span>
						<span>
							{result.fps.p1} / {result.fps.p5}
						</span>
						<span css={{ color: "#888" }}>Jank</span>
						<span>
							{result.jank.count} ({result.jank.pct})
						</span>
						<span css={{ color: "#888" }}>Long tasks</span>
						<span>
							{result.longTasks.count} ({result.longTasks.totalBlockingTimeMs}ms
							blocking)
						</span>
						<span css={{ color: "#888" }}>CLS</span>
						<span
							style={{
								color:
									Number(result.layoutShifts.cumulativeCLS) > 0.1
										? "#f44336"
										: "#4caf50",
							}}
						>
							{result.layoutShifts.cumulativeCLS} ({result.layoutShifts.total}{" "}
							shifts)
						</span>
						<span css={{ color: "#888" }}>Memory</span>
						<span>
							{result.memory.startMB} → {result.memory.endMB} MB (+
							{result.memory.growthMB})
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
