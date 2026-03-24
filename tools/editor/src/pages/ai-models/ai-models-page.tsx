import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";
import {
	type Column,
	EditableTable,
} from "../../components/shared/editable-table";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useAiModelsStore } from "../../store/data-store";

type AiModel = {
	id: string;
	family: string;
	name: string;
	version: string;
	icon: string;
	tier: string;
	cost: number;
	locPerSec: number;
	flopsCost: number;
	codeQuality: number;
	requires?: string;
	special?: Record<string, unknown>;
};

type AgentSetup = {
	id: string;
	name: string;
	description: string;
	requiredModels: number;
	unlockCondition: string;
	slots: unknown;
	effects: Record<string, unknown>;
};

const FAMILY_OPTIONS = [
	"copilot",
	"claude",
	"gpt",
	"gemini",
	"llama",
	"mistral",
	"grok",
];

const TIER_OPTIONS = ["ai_lab", "agi_race"];

const modelColumns: Column<AiModel>[] = [
	{ key: "icon", label: "Icon", width: "30px", editable: true },
	{ key: "id", label: "ID", width: "120px", editable: true },
	{
		key: "family",
		label: "Family",
		width: "100px",
		type: "select",
		options: FAMILY_OPTIONS,
	},
	{ key: "name", label: "Name", width: "100px", editable: true },
	{ key: "version", label: "Version", width: "80px", editable: true },
	{
		key: "tier",
		label: "Tier",
		width: "90px",
		type: "select",
		options: TIER_OPTIONS,
	},
	{ key: "cost", label: "Cost", width: "100px", type: "number" },
	{ key: "locPerSec", label: "LoC/s", width: "80px", type: "number" },
	{ key: "flopsCost", label: "FLOPS", width: "80px", type: "number" },
	{ key: "codeQuality", label: "Quality", width: "70px", type: "number" },
	{ key: "requires", label: "Requires", width: "120px", editable: true },
];

const agentColumns: Column<AgentSetup>[] = [
	{ key: "id", label: "ID", width: "140px", editable: true },
	{ key: "name", label: "Name", width: "160px", editable: true },
	{ key: "description", label: "Description", editable: true },
	{
		key: "requiredModels",
		label: "Req. Models",
		width: "90px",
		type: "number",
	},
	{
		key: "unlockCondition",
		label: "Unlock Condition",
		width: "160px",
		editable: true,
	},
];

const sectionStyle = css`
	margin-top: 32px;
`;

const sectionTitleStyle = css`
	font-size: 16px;
	font-weight: 600;
	color: #8892b0;
	margin-bottom: 12px;
`;

function makeDefaultModel(): AiModel {
	return {
		id: `new_model_${Date.now()}`,
		family: "copilot",
		name: "New Model",
		version: "1.0",
		icon: "🤖",
		tier: "ai_lab",
		cost: 1000000,
		locPerSec: 1000,
		flopsCost: 500,
		codeQuality: 70,
	};
}

function makeDefaultAgentSetup(): AgentSetup {
	return {
		id: `new_setup_${Date.now()}`,
		name: "New Setup",
		description: "",
		requiredModels: 2,
		unlockCondition: "ownedModels >= 2",
		slots: [],
		effects: {},
	};
}

export function AiModelsPage() {
	const store = useAiModelsStore();
	const models = useMemo(
		() => (store.data?.models ?? []) as AiModel[],
		[store.data],
	);
	const agentSetups = useMemo(
		() => (store.data?.agentSetups ?? []) as AgentSetup[],
		[store.data],
	);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const handleModelChange = useCallback(
		(index: number, row: AiModel) => {
			const next = [...models];
			next[index] = row;
			store.update({ ...store.data, models: next, agentSetups });
		},
		[models, agentSetups, store.update, store.data],
	);

	const handleModelAdd = useCallback(() => {
		store.update({
			...store.data,
			models: [...models, makeDefaultModel()],
			agentSetups,
		});
	}, [models, agentSetups, store.update, store.data]);

	const handleModelDelete = useCallback(
		(index: number) => {
			const next = [...models];
			next.splice(index, 1);
			store.update({ ...store.data, models: next, agentSetups });
		},
		[models, agentSetups, store.update, store.data],
	);

	const handleSetupChange = useCallback(
		(index: number, row: AgentSetup) => {
			const next = [...agentSetups];
			next[index] = row;
			store.update({ ...store.data, models, agentSetups: next });
		},
		[models, agentSetups, store.update, store.data],
	);

	const handleSetupAdd = useCallback(() => {
		store.update({
			...store.data,
			models,
			agentSetups: [...agentSetups, makeDefaultAgentSetup()],
		});
	}, [models, agentSetups, store.update, store.data]);

	const handleSetupDelete = useCallback(
		(index: number) => {
			const next = [...agentSetups];
			next.splice(index, 1);
			store.update({ ...store.data, models, agentSetups: next });
		},
		[models, agentSetups, store.update, store.data],
	);

	const modelGroupBy = useCallback((row: AiModel) => row.family, []);
	const modelRowKey = useCallback((row: AiModel) => row.id, []);
	const setupRowKey = useCallback((row: AgentSetup) => row.id, []);

	return (
		<PageWrapper
			title="AI Models"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			<EditableTable<AiModel>
				data={models}
				columns={modelColumns}
				rowKey={modelRowKey}
				onRowChange={handleModelChange}
				onRowAdd={handleModelAdd}
				onRowDelete={handleModelDelete}
				groupBy={modelGroupBy}
			/>
			<div css={sectionStyle}>
				<div css={sectionTitleStyle}>Agent Setups</div>
				<EditableTable<AgentSetup>
					data={agentSetups}
					columns={agentColumns}
					rowKey={setupRowKey}
					onRowChange={handleSetupChange}
					onRowAdd={handleSetupAdd}
					onRowDelete={handleSetupDelete}
				/>
			</div>
		</PageWrapper>
	);
}
