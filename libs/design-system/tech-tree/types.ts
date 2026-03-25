export const NodeStateEnum = {
	locked: "locked",
	visible: "visible",
	affordable: "affordable",
	owned: "owned",
} as const;

export type NodeStateEnum = (typeof NodeStateEnum)[keyof typeof NodeStateEnum];

export type TechNodeEffect = {
	type: string;
	op: string;
	value: string | number | boolean;
};

export type TechNode = {
	id: string;
	name: string;
	description: string;
	icon: string;
	requires: string[];
	max: number;
	baseCost: number;
	costMultiplier: number;
	currency: string;
	effects: TechNodeEffect[];
	x: number;
	y: number;
};
