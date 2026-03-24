import { create } from "zustand";
import { fetchData, saveData } from "../api/client";

const MAX_UNDO = 20;

interface DataStoreState<T> {
	data: T | null;
	savedData: T | null;
	undoStack: T[];
	loading: boolean;
	dirty: boolean;
	error: string | null;
	load: () => Promise<void>;
	save: () => Promise<void>;
	update: (data: T) => void;
	undo: () => void;
}

export function createDataStore<T>(file: string) {
	return create<DataStoreState<T>>((set, get) => ({
		data: null,
		savedData: null,
		undoStack: [],
		loading: false,
		dirty: false,
		error: null,

		load: async () => {
			set({ loading: true, error: null });
			try {
				const data = await fetchData<T>(file);
				set({
					data,
					savedData: data,
					loading: false,
					dirty: false,
					undoStack: [],
				});
			} catch (err) {
				set({ error: String(err), loading: false });
			}
		},

		save: async () => {
			const { data } = get();
			if (!data) return;
			try {
				await saveData(file, data);
				set({ savedData: data, dirty: false, error: null });
			} catch (err) {
				set({ error: String(err) });
			}
		},

		update: (data: T) => {
			const { data: prev, undoStack } = get();
			if (!prev) {
				set({ data, dirty: true });
				return;
			}
			const newStack = [...undoStack, prev].slice(-MAX_UNDO);
			const { savedData } = get();
			const dirty = JSON.stringify(data) !== JSON.stringify(savedData);
			set({ data, undoStack: newStack, dirty });
		},

		undo: () => {
			const { undoStack, savedData } = get();
			if (undoStack.length === 0) return;
			const prev = undoStack[undoStack.length - 1];
			const newStack = undoStack.slice(0, -1);
			const dirty = JSON.stringify(prev) !== JSON.stringify(savedData);
			set({ data: prev, undoStack: newStack, dirty });
		},
	}));
}

// One store per data file
export const useTiersStore = createDataStore<{ tiers: unknown[] }>("tiers");
export const useUpgradesStore =
	createDataStore<{ upgrades: unknown[] }>("upgrades");
export const useTechTreeStore =
	createDataStore<{ nodes: unknown[] }>("tech-tree");
export const useAiModelsStore = createDataStore<{
	models: unknown[];
	agentSetups: unknown[];
}>("ai-models");
export const useBalanceStore =
	createDataStore<Record<string, unknown>>("balance");
export const useEventsStore = createDataStore<{
	events: unknown[];
	eventConfig: Record<string, unknown>;
}>("events");
export const useMilestonesStore = createDataStore<{
	milestones: unknown[];
}>("milestones");
