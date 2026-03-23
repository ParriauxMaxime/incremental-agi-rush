import { useCallback, useMemo } from "react";
import {
	type Column,
	EditableTable,
} from "../../components/shared/editable-table";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useMilestonesStore } from "../../store/data-store";

type Milestone = {
	id: string;
	name: string;
	metric: string;
	threshold: number;
	condition: string;
	description: string;
};

const columns: Column<Milestone>[] = [
	{ key: "id", label: "ID", width: "140px", editable: true },
	{ key: "name", label: "Name", width: "160px", editable: true },
	{ key: "metric", label: "Metric", width: "100px", editable: true },
	{ key: "threshold", label: "Threshold", width: "100px", type: "number" },
	{ key: "condition", label: "Condition", width: "200px", editable: true },
	{ key: "description", label: "Description", editable: true },
];

function makeDefaultMilestone(): Milestone {
	return {
		id: `new_milestone_${Date.now()}`,
		name: "New Milestone",
		metric: "totalLoc",
		threshold: 0,
		condition: "totalLoc >= 0",
		description: "",
	};
}

export function MilestonesPage() {
	const store = useMilestonesStore();
	const milestones = useMemo(
		() => (store.data?.milestones ?? []) as Milestone[],
		[store.data],
	);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const handleRowChange = useCallback(
		(index: number, row: Milestone) => {
			const next = [...milestones];
			next[index] = row;
			store.update({ milestones: next });
		},
		[milestones, store.update],
	);

	const handleAdd = useCallback(() => {
		store.update({ milestones: [...milestones, makeDefaultMilestone()] });
	}, [milestones, store.update]);

	const handleDelete = useCallback(
		(index: number) => {
			const next = [...milestones];
			next.splice(index, 1);
			store.update({ milestones: next });
		},
		[milestones, store.update],
	);

	const rowKey = useCallback((row: Milestone) => row.id, []);

	return (
		<PageWrapper
			title="Milestones"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			<EditableTable<Milestone>
				data={milestones}
				columns={columns}
				rowKey={rowKey}
				onRowChange={handleRowChange}
				onRowAdd={handleAdd}
				onRowDelete={handleDelete}
			/>
		</PageWrapper>
	);
}
