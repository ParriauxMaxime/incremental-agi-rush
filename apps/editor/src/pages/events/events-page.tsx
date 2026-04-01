import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useEventsStore } from "../../store/data-store";

type EventEffect = {
	type: string;
	op?: string;
	value?: number | string;
	threshold?: string;
	reward?: string;
	options?: Array<{
		label: string;
		effect: { type: string; op?: string; value?: number | string };
	}>;
};

type GameEvent = {
	id: string;
	name: string;
	description: string;
	icon: string;
	minTier: string;
	maxTier?: string;
	duration: number;
	weight: number;
	effects: EventEffect[];
	interaction?: { type: string; reductionPerKey: number };
};

type EventConfig = {
	minIntervalSeconds: number;
	maxIntervalSeconds: number;
	maxConcurrent: number;
};

const TIER_ORDER = [
	"garage",
	"freelancing",
	"startup",
	"tech_company",
	"ai_lab",
	"agi_race",
];

const TIER_LABELS: Record<string, string> = {
	garage: "The Garage",
	freelancing: "Freelancing",
	startup: "Startup",
	tech_company: "Tech Company",
	ai_lab: "AI Lab",
	agi_race: "AGI Race",
};

const TIER_COLORS: Record<string, string> = {
	garage: "#8b949e",
	freelancing: "#3794ff",
	startup: "#3fb950",
	tech_company: "#d29922",
	ai_lab: "#bc8cff",
	agi_race: "#f78166",
};

// ── Styles ──

const configSectionCss = css({
	display: "flex",
	gap: 24,
	marginBottom: 24,
	padding: 16,
	background: "#161b22",
	borderRadius: 8,
	border: "1px solid #21262d",
});

const configFieldCss = css({
	display: "flex",
	flexDirection: "column",
	gap: 4,
});

const configLabelCss = css({
	fontSize: 11,
	color: "#8b949e",
	textTransform: "uppercase",
	letterSpacing: 0.5,
});

const configInputCss = css({
	background: "#0d1117",
	border: "1px solid #21262d",
	borderRadius: 4,
	color: "#c9d1d9",
	padding: "6px 10px",
	fontSize: 13,
	width: 120,
	"&:focus": { outline: "none", borderColor: "#58a6ff" },
});

const sectionTitleCss = css({
	fontSize: 15,
	fontWeight: 600,
	color: "#8b949e",
	marginBottom: 8,
	textTransform: "uppercase",
	letterSpacing: 0.5,
});

const tierGroupCss = css({
	marginBottom: 28,
});

const tierHeaderCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginBottom: 12,
	paddingBottom: 6,
	borderBottom: "1px solid #21262d",
});

const tierLabelCss = css({
	fontSize: 14,
	fontWeight: 600,
});

const tierCountCss = css({
	fontSize: 12,
	color: "#8b949e",
});

const cardGridCss = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
	gap: 12,
});

const cardCss = css({
	background: "#161b22",
	border: "1px solid #21262d",
	borderRadius: 8,
	padding: 14,
	transition: "border-color 0.15s",
	"&:hover": { borderColor: "#30363d" },
});

const cardHeaderCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginBottom: 8,
});

const cardIconCss = css({
	fontSize: 20,
	flexShrink: 0,
});

const cardNameCss = css({
	fontSize: 14,
	fontWeight: 600,
	color: "#e6edf3",
	flex: 1,
});

const cardIdCss = css({
	fontSize: 11,
	color: "#484f58",
	fontFamily: "'Courier New', monospace",
});

const cardDescCss = css({
	fontSize: 12,
	color: "#8b949e",
	lineHeight: 1.5,
	marginBottom: 10,
});

const cardMetaCss = css({
	display: "flex",
	gap: 8,
	flexWrap: "wrap",
	marginBottom: 8,
});

const badgeCss = css({
	display: "inline-flex",
	alignItems: "center",
	gap: 4,
	fontSize: 11,
	padding: "2px 8px",
	borderRadius: 12,
	background: "#21262d",
	color: "#8b949e",
});

const effectListCss = css({
	display: "flex",
	flexDirection: "column",
	gap: 4,
});

const effectRowCss = css({
	fontSize: 12,
	color: "#c9d1d9",
	fontFamily: "'Courier New', monospace",
	padding: "3px 8px",
	background: "#0d1117",
	borderRadius: 4,
	border: "1px solid #21262d",
});

const choiceContainerCss = css({
	marginTop: 4,
	padding: "6px 8px",
	background: "#0d1117",
	borderRadius: 4,
	border: "1px solid #21262d",
});

const choiceLabelCss = css({
	fontSize: 11,
	color: "#d29922",
	fontWeight: 600,
	marginBottom: 4,
});

const choiceOptionCss = css({
	fontSize: 12,
	color: "#c9d1d9",
	fontFamily: "'Courier New', monospace",
	padding: "2px 0",
});

const tierRangeCss = css({
	fontSize: 11,
	padding: "2px 8px",
	borderRadius: 12,
	border: "1px solid",
});

// ── Helpers ──

function formatEffectValue(v: number | string | undefined): string {
	if (v === undefined) return "";
	if (typeof v === "string") return v;
	if (v === 0) return "0";
	return String(v);
}

function describeEffect(e: EventEffect): string {
	if (e.type === "choice") return "";
	if (e.type === "conditionalCash") {
		return `if LoC/s >= ${e.threshold} → +${e.reward}`;
	}
	const prefix = e.op === "multiply" ? "×" : e.op === "set" ? "=" : "+";
	return `${e.type} ${prefix}${formatEffectValue(e.value)}`;
}

function sentimentColor(effects: EventEffect[]): string {
	if (effects.some((e) => e.type === "choice")) return "#d29922";
	const allPositive = effects.every((e) => {
		if (e.type === "instantCash" || e.type === "instantLoc") return true;
		if (e.type === "conditionalCash") return true;
		if ("value" in e && typeof e.value === "number") return e.value >= 1;
		return true;
	});
	return allPositive ? "#3fb950" : "#f85149";
}

// ── Components ──

function EventCard({ event }: { event: GameEvent }) {
	const accent = sentimentColor(event.effects);
	const hasChoice = event.effects.some((e) => e.type === "choice");
	const hasMash = !!event.interaction;
	const tierColor = TIER_COLORS[event.minTier] ?? "#8b949e";

	return (
		<div css={[cardCss, { borderLeftColor: accent, borderLeftWidth: 3 }]}>
			<div css={cardHeaderCss}>
				<span css={cardIconCss}>{event.icon}</span>
				<span css={cardNameCss}>{event.name}</span>
				<span css={cardIdCss}>{event.id}</span>
			</div>
			<div css={cardDescCss}>{event.description}</div>
			<div css={cardMetaCss}>
				{event.duration > 0 ? (
					<span css={badgeCss}>⏱ {event.duration}s</span>
				) : (
					<span css={badgeCss}>⚡ instant</span>
				)}
				<span css={badgeCss}>⚖ weight {event.weight}</span>
				{hasMash && (
					<span css={[badgeCss, { color: "#58a6ff" }]}>
						⌨ mash (-{event.interaction?.reductionPerKey}s/key)
					</span>
				)}
				{hasChoice && (
					<span css={[badgeCss, { color: "#d29922" }]}>🔀 choice</span>
				)}
				<span
					css={[tierRangeCss, { color: tierColor, borderColor: tierColor }]}
				>
					{TIER_LABELS[event.minTier]}
					{event.maxTier && event.maxTier !== event.minTier
						? ` → ${TIER_LABELS[event.maxTier]}`
						: "+"}
				</span>
			</div>
			<div css={effectListCss}>
				{event.effects
					.filter((e) => e.type !== "choice")
					.map((e, i) => (
						<div key={i} css={effectRowCss}>
							{describeEffect(e)}
						</div>
					))}
				{event.effects
					.filter((e) => e.type === "choice")
					.map((e, i) =>
						e.type === "choice" ? (
							<div key={`choice-${i}`} css={choiceContainerCss}>
								<div css={choiceLabelCss}>Player Choice</div>
								{e.options?.map((opt, j) => (
									<div key={j} css={choiceOptionCss}>
										{opt.label}:{" "}
										{opt.effect.type === "instantCash"
											? `+${formatEffectValue(opt.effect.value)} cash`
											: `${opt.effect.type} ${opt.effect.op === "multiply" ? "×" : ""}${formatEffectValue(opt.effect.value)}`}
										{(opt.effect as { duration?: number }).duration
											? ` (${(opt.effect as { duration?: number }).duration}s)`
											: ""}
									</div>
								))}
							</div>
						) : null,
					)}
			</div>
		</div>
	);
}

export function EventsPage() {
	const store = useEventsStore();
	const events = useMemo(
		() => (store.data?.events ?? []) as GameEvent[],
		[store.data],
	);
	const eventConfig = useMemo(
		() => (store.data?.eventConfig ?? {}) as EventConfig,
		[store.data],
	);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const handleConfigChange = useCallback(
		(key: keyof EventConfig, value: number) => {
			store.update({
				...store.data,
				events,
				eventConfig: { ...eventConfig, [key]: value },
			});
		},
		[events, eventConfig, store.update, store.data],
	);

	// Group events by minTier
	const grouped = useMemo(() => {
		const groups: Record<string, GameEvent[]> = {};
		for (const tier of TIER_ORDER) groups[tier] = [];
		for (const ev of events) {
			const tier = ev.minTier || "garage";
			if (!groups[tier]) groups[tier] = [];
			groups[tier].push(ev);
		}
		return groups;
	}, [events]);

	return (
		<PageWrapper
			title="Events"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			<div css={sectionTitleCss}>Event Config</div>
			<div css={configSectionCss}>
				<div css={configFieldCss}>
					<label css={configLabelCss}>Min Interval (s)</label>
					<input
						type="number"
						css={configInputCss}
						value={eventConfig.minIntervalSeconds ?? 0}
						onChange={(e) =>
							handleConfigChange("minIntervalSeconds", Number(e.target.value))
						}
					/>
				</div>
				<div css={configFieldCss}>
					<label css={configLabelCss}>Max Interval (s)</label>
					<input
						type="number"
						css={configInputCss}
						value={eventConfig.maxIntervalSeconds ?? 0}
						onChange={(e) =>
							handleConfigChange("maxIntervalSeconds", Number(e.target.value))
						}
					/>
				</div>
				<div css={configFieldCss}>
					<label css={configLabelCss}>Max Concurrent</label>
					<input
						type="number"
						css={configInputCss}
						value={eventConfig.maxConcurrent ?? 0}
						onChange={(e) =>
							handleConfigChange("maxConcurrent", Number(e.target.value))
						}
					/>
				</div>
			</div>

			{TIER_ORDER.map((tier) => {
				const tierEvents = grouped[tier];
				if (!tierEvents || tierEvents.length === 0) return null;
				const color = TIER_COLORS[tier];
				return (
					<div key={tier} css={tierGroupCss}>
						<div css={tierHeaderCss}>
							<span css={[tierLabelCss, { color }]}>{TIER_LABELS[tier]}</span>
							<span css={tierCountCss}>
								{tierEvents.length} event{tierEvents.length !== 1 ? "s" : ""}
							</span>
						</div>
						<div css={cardGridCss}>
							{tierEvents.map((ev) => (
								<EventCard key={ev.id} event={ev} />
							))}
						</div>
					</div>
				);
			})}
		</PageWrapper>
	);
}
