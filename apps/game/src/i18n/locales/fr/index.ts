import aiModels from "./ai-models.json";
import events from "./events.json";
import milestones from "./milestones.json";
import techTree from "./tech-tree.json";
import tiers from "./tiers.json";
import tutorial from "./tutorial.json";
import ui from "./ui.json";
import upgrades from "./upgrades.json";

export default {
	ui,
	upgrades,
	"tech-tree": techTree,
	tiers,
	events,
	milestones,
	"ai-models": aiModels,
	tutorial,
} as Record<string, Record<string, unknown>>;
