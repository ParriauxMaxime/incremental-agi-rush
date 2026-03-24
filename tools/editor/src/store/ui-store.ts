import { create } from "zustand";
import {
	useAiModelsStore,
	useBalanceStore,
	useEventsStore,
	useMilestonesStore,
	useTechTreeStore,
	useTiersStore,
	useUpgradesStore,
} from "./data-store";

export const PageEnum = {
	tech_tree: "tech_tree",
	upgrades: "upgrades",
	ai_models: "ai_models",
	events: "events",
	milestones: "milestones",
	tiers: "tiers",
	balance: "balance",
	simulation: "simulation",
} as const;
export type PageEnum = (typeof PageEnum)[keyof typeof PageEnum];

interface Toast {
	id: number;
	message: string;
	type: "success" | "error";
}

interface UiState {
	activePage: PageEnum;
	setPage: (page: PageEnum) => void;
	toasts: Toast[];
	addToast: (message: string, type: "success" | "error") => void;
	removeToast: (id: number) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>((set) => ({
	activePage: PageEnum.tech_tree,

	setPage: (page) => {
		const stores = [
			useTiersStore,
			useUpgradesStore,
			useTechTreeStore,
			useAiModelsStore,
			useBalanceStore,
			useEventsStore,
			useMilestonesStore,
		];
		const hasDirty = stores.some((s) => s.getState().dirty);
		if (
			hasDirty &&
			!window.confirm("You have unsaved changes. Navigate away?")
		)
			return;
		set({ activePage: page });
	},

	toasts: [],

	addToast: (message, type) => {
		const id = ++toastId;
		set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
		}, 3000);
	},

	removeToast: (id) =>
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
