import { useCallback, useMemo } from "react";
import {
	type Column,
	EditableTable,
} from "../../components/shared/editable-table";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useTiersStore } from "../../store/data-store";

type Tier = {
	id: string;
	index: number;
	name: string;
	tagline: string;
	cashPerLoc: number;
	locRequired: number;
	cashRequired: number;
	cost: number;
};

const columns: Column<Tier>[] = [
	{ key: "index", label: "#", width: "30px" },
	{ key: "id", label: "ID", width: "120px" },
	{ key: "name", label: "Name", width: "140px", editable: true },
	{ key: "tagline", label: "Tagline", width: "240px", editable: true },
	{ key: "cashPerLoc", label: "$/LoC", width: "80px", type: "number" },
	{ key: "locRequired", label: "LoC Req", width: "100px", type: "number" },
	{ key: "cashRequired", label: "Cash Req", width: "100px", type: "number" },
	{ key: "cost", label: "Cost", width: "100px", type: "number" },
];

export function TiersPage() {
	const store = useTiersStore();
	const tiers = useMemo(
		() => (store.data?.tiers ?? []) as Tier[],
		[store.data],
	);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const handleRowChange = useCallback(
		(index: number, row: Tier) => {
			const next = [...tiers];
			next[index] = row;
			store.update({ tiers: next });
		},
		[tiers, store.update],
	);

	const rowKey = useCallback((row: Tier) => row.id, []);

	return (
		<PageWrapper
			title="Tiers"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			<EditableTable<Tier>
				data={tiers}
				columns={columns}
				rowKey={rowKey}
				onRowChange={handleRowChange}
			/>
		</PageWrapper>
	);
}
