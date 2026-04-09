export interface AiModelData {
	id: string;
	family: string;
	name: string;
	version: string;
	icon: string;
	tier: string;
	cost: number;
	locPerSec: number;
	flopsCost: number;
	tokenCost: number;
	locPerToken: number;
	codeQuality: number;
	requires?: string;
	special?: Record<string, unknown>;
}

export interface AgentSetup {
	id: string;
	name: string;
	description: string;
	requiredModels: number;
	unlockCondition: string;
	slots: unknown[];
	effects: Record<string, string>;
}
