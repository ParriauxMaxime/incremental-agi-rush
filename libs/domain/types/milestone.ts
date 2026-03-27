export interface Milestone {
	id: string;
	name: string;
	description: string;
	condition: string;
	threshold: number;
	metric: string;
	cashBonus?: number;
}
