import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";
import {
	type Column,
	EditableTable,
} from "../../components/shared/editable-table";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useEventsStore } from "../../store/data-store";

type GameEvent = {
	id: string;
	name: string;
	description: string;
	icon: string;
	minTier: string;
	duration: number;
	weight: number;
	effects: unknown[];
	interaction?: Record<string, unknown>;
};

type EventConfig = {
	minIntervalSeconds: number;
	maxIntervalSeconds: number;
	maxConcurrent: number;
};

const TIER_OPTIONS = [
	"garage",
	"freelancing",
	"startup",
	"tech_company",
	"ai_lab",
	"agi_race",
];

const effectsBadge = css`
	display: inline-block;
	background: #2a2a4a;
	color: #8892b0;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
`;

const eventColumns: Column<GameEvent>[] = [
	{ key: "icon", label: "Icon", width: "30px", editable: true },
	{ key: "id", label: "ID", width: "140px", editable: true },
	{ key: "name", label: "Name", width: "160px", editable: true },
	{
		key: "minTier",
		label: "Min Tier",
		width: "110px",
		type: "select",
		options: TIER_OPTIONS,
	},
	{ key: "duration", label: "Duration", width: "70px", type: "number" },
	{ key: "weight", label: "Weight", width: "60px", type: "number" },
	{
		key: "effects",
		label: "Effects",
		width: "100px",
		render: (value) => {
			const arr = Array.isArray(value) ? value : [];
			return <span css={effectsBadge}>{arr.length} effect{arr.length !== 1 ? "s" : ""}</span>;
		},
	},
	{ key: "description", label: "Description", editable: true },
];

const configSectionStyle = css`
	display: flex;
	gap: 24px;
	margin-bottom: 24px;
	padding: 16px;
	background: #16213e;
	border-radius: 8px;
	border: 1px solid #2a2a4a;
`;

const configFieldStyle = css`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

const configLabelStyle = css`
	font-size: 12px;
	color: #8892b0;
	font-weight: 500;
`;

const configInputStyle = css`
	background: #0a0f1e;
	border: 1px solid #2a2a4a;
	border-radius: 4px;
	color: #ccd6f6;
	padding: 6px 10px;
	font-size: 13px;
	width: 120px;
	&:focus {
		outline: none;
		border-color: #64ffda;
	}
`;

const sectionTitleStyle = css`
	font-size: 16px;
	font-weight: 600;
	color: #8892b0;
	margin-bottom: 12px;
`;

function makeDefaultEvent(): GameEvent {
	return {
		id: `new_event_${Date.now()}`,
		name: "New Event",
		description: "",
		icon: "🎲",
		minTier: "garage",
		duration: 15,
		weight: 5,
		effects: [],
	};
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

	const handleRowChange = useCallback(
		(index: number, row: GameEvent) => {
			const next = [...events];
			next[index] = row;
			store.update({ ...store.data, events: next, eventConfig });
		},
		[events, eventConfig, store.update, store.data],
	);

	const handleAdd = useCallback(() => {
		store.update({
			...store.data,
			events: [...events, makeDefaultEvent()],
			eventConfig,
		});
	}, [events, eventConfig, store.update, store.data]);

	const handleDelete = useCallback(
		(index: number) => {
			const next = [...events];
			next.splice(index, 1);
			store.update({ ...store.data, events: next, eventConfig });
		},
		[events, eventConfig, store.update, store.data],
	);

	const rowKey = useCallback((row: GameEvent) => row.id, []);

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
			<div css={sectionTitleStyle}>Event Config</div>
			<div css={configSectionStyle}>
				<div css={configFieldStyle}>
					<label css={configLabelStyle}>Min Interval (s)</label>
					<input
						type="number"
						css={configInputStyle}
						value={eventConfig.minIntervalSeconds ?? 0}
						onChange={(e) =>
							handleConfigChange(
								"minIntervalSeconds",
								Number(e.target.value),
							)
						}
					/>
				</div>
				<div css={configFieldStyle}>
					<label css={configLabelStyle}>Max Interval (s)</label>
					<input
						type="number"
						css={configInputStyle}
						value={eventConfig.maxIntervalSeconds ?? 0}
						onChange={(e) =>
							handleConfigChange(
								"maxIntervalSeconds",
								Number(e.target.value),
							)
						}
					/>
				</div>
				<div css={configFieldStyle}>
					<label css={configLabelStyle}>Max Concurrent</label>
					<input
						type="number"
						css={configInputStyle}
						value={eventConfig.maxConcurrent ?? 0}
						onChange={(e) =>
							handleConfigChange(
								"maxConcurrent",
								Number(e.target.value),
							)
						}
					/>
				</div>
			</div>
			<div css={sectionTitleStyle}>Events</div>
			<EditableTable<GameEvent>
				data={events}
				columns={eventColumns}
				rowKey={rowKey}
				onRowChange={handleRowChange}
				onRowAdd={handleAdd}
				onRowDelete={handleDelete}
			/>
		</PageWrapper>
	);
}
