import { useCallback, useMemo } from "react";
import {
	type Column,
	EditableTable,
} from "../../components/shared/editable-table";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useUpgradesStore } from "../../store/data-store";

type Upgrade = {
	id: string;
	tier: string;
	name: string;
	description: string;
	icon: string;
	baseCost: number;
	costMultiplier: number;
	max: number;
	costCategory?: string;
	effects: unknown[];
	requires?: string[];
};

const TIER_OPTIONS = [
	"garage",
	"freelancing",
	"startup",
	"tech_company",
	"ai_lab",
	"agi_race",
];

const columns: Column<Upgrade>[] = [
	{ key: "icon", label: "Icon", width: "30px", editable: true },
	{ key: "id", label: "ID", width: "160px", editable: true },
	{ key: "name", label: "Name", width: "160px", editable: true },
	{
		key: "tier",
		label: "Tier",
		width: "120px",
		type: "select",
		options: TIER_OPTIONS,
	},
	{ key: "baseCost", label: "Cost", width: "80px", type: "number" },
	{
		key: "costMultiplier",
		label: "Mult",
		width: "60px",
		type: "number",
	},
	{ key: "max", label: "Max", width: "50px", type: "number" },
	{
		key: "requires",
		label: "Requires (tech nodes)",
		width: "160px",
		editable: true,
	},
	{ key: "description", label: "Description", editable: true },
];

function makeDefaultUpgrade(): Upgrade {
	return {
		id: `new_upgrade_${Date.now()}`,
		tier: "garage",
		name: "New Upgrade",
		description: "",
		icon: "🆕",
		baseCost: 100,
		costMultiplier: 1.5,
		max: 1,
		effects: [],
	};
}

export function UpgradesPage() {
	const store = useUpgradesStore();
	const upgrades = useMemo(
		() => (store.data?.upgrades ?? []) as Upgrade[],
		[store.data],
	);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const handleRowChange = useCallback(
		(index: number, row: Upgrade) => {
			const next = [...upgrades];
			// Convert comma-separated requires string back to array
			const req = row.requires as unknown;
			if (typeof req === "string") {
				const parsed = (req as string)
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
				row = { ...row, requires: parsed.length > 0 ? parsed : undefined };
			}
			next[index] = row;
			store.update({ upgrades: next });
		},
		[upgrades, store.update],
	);

	const handleAdd = useCallback(() => {
		store.update({ upgrades: [...upgrades, makeDefaultUpgrade()] });
	}, [upgrades, store.update]);

	const handleDelete = useCallback(
		(index: number) => {
			const next = [...upgrades];
			next.splice(index, 1);
			store.update({ upgrades: next });
		},
		[upgrades, store.update],
	);

	const groupBy = useCallback((row: Upgrade) => row.tier, []);
	const rowKey = useCallback((row: Upgrade) => row.id, []);

	return (
		<PageWrapper
			title="Upgrades"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			<EditableTable<Upgrade>
				data={upgrades}
				columns={columns}
				rowKey={rowKey}
				onRowChange={handleRowChange}
				onRowAdd={handleAdd}
				onRowDelete={handleDelete}
				groupBy={groupBy}
			/>
		</PageWrapper>
	);
}
