import {
	aiModelsJson,
	balanceJson,
	eventsJson,
	techTreeJson,
	tiers,
	tiersJson,
	upgradesJson,
} from "@flopsed/domain";
import type { SimData, SimResult } from "@flopsed/engine";
import { runBalanceSim } from "@flopsed/engine";

// ── CLI flags ──

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOutput = args.includes("--json");
const traceOutput = args.includes("--trace");
const profileFlag = args.includes("--profile")
	? args[args.indexOf("--profile") + 1]
	: null;

// ── Validation thresholds from balance.json ──

const validation = (balanceJson as Record<string, unknown>).validation as {
	agiMinMinutes: number;
	agiMaxMinutes: number;
	maxWaitSeconds: number;
	minPurchases: number;
	maxPurchases: number;
	minTiers: number;
	tierMinDuration: Record<string, number>;
	tierMaxDuration: Record<string, number>;
};

// ── Profiles ──

const ProfileEnum = {
	casual: "casual",
	average: "average",
	fast: "fast",
} as const;
type ProfileEnum = (typeof ProfileEnum)[keyof typeof ProfileEnum];

interface Profile {
	name: ProfileEnum;
	label: string;
	keysPerSec: number;
	skill: number;
}

const profiles: Profile[] = [
	{
		name: ProfileEnum.casual,
		label: "Casual (4 keys/s)",
		keysPerSec: 4,
		skill: 0.6,
	},
	{
		name: ProfileEnum.average,
		label: "Average (6 keys/s)",
		keysPerSec: 6,
		skill: 0.8,
	},
	{
		name: ProfileEnum.fast,
		label: "Fast (9 keys/s)",
		keysPerSec: 9,
		skill: 0.95,
	},
];

// ── Assemble SimData ──

const simData: SimData = {
	aiModels: aiModelsJson.models as SimData["aiModels"],
	balance: balanceJson as unknown as SimData["balance"],
	events: eventsJson as unknown as SimData["events"],
	techTree: techTreeJson as unknown as SimData["techTree"],
	tiers: tiersJson as unknown as SimData["tiers"],
	upgrades: upgradesJson as unknown as SimData["upgrades"],
};

// ── Run simulation and validate ──

interface ProfileResult {
	name: string;
	keysPerSec: number;
	passed: boolean;
	agiMinutes: number | null;
	purchases: number;
	longestWait: number;
	tiersReached: number;
	tierDurations: Record<string, number>;
	failures: string[];
	aiModelsOwned: number;
	idle: {
		totalIdleTime: number;
		idlePercent: number;
		avgGap: number;
		medianGap: number;
		topGaps: { duration: number; nextPurchase: string }[];
	};
}

function validateProfile(profile: Profile): ProfileResult {
	const result: SimResult = runBalanceSim(simData, {
		keysPerSec: profile.keysPerSec,
		skill: profile.skill,
		maxMinutes: 90,
	});

	const failures: string[] = [];
	const agiMinutes = result.agiTime !== null ? result.agiTime / 60 : null;

	// AGI time check
	if (result.agiTime === null) {
		failures.push(`AGI never reached in ${validation.agiMaxMinutes} minutes`);
	} else {
		if (agiMinutes !== null && agiMinutes < validation.agiMinMinutes) {
			failures.push(
				`AGI too fast: ${agiMinutes.toFixed(1)}min (min: ${validation.agiMinMinutes})`,
			);
		}
		if (agiMinutes !== null && agiMinutes > validation.agiMaxMinutes) {
			failures.push(
				`AGI too slow: ${agiMinutes.toFixed(1)}min (max: ${validation.agiMaxMinutes})`,
			);
		}
	}

	// Purchase count check
	if (result.purchaseCount < validation.minPurchases) {
		failures.push(
			`Too few purchases: ${result.purchaseCount} (min: ${validation.minPurchases})`,
		);
	}
	if (result.purchaseCount > validation.maxPurchases) {
		failures.push(
			`Too many purchases: ${result.purchaseCount} (max: ${validation.maxPurchases})`,
		);
	}

	// Longest wait check
	if (result.longestWait > validation.maxWaitSeconds) {
		failures.push(
			`Longest wait: ${result.longestWait}s (max: ${validation.maxWaitSeconds}s)`,
		);
	}

	// Tiers reached check
	const tiersReached = Object.keys(result.tierTimes).length;
	if (tiersReached < validation.minTiers) {
		failures.push(
			`Only ${tiersReached} tiers reached (need ${validation.minTiers})`,
		);
	}

	// Per-tier duration check
	const tierDurations: Record<string, number> = {};
	const tierIds = tiers.map((t) => t.id);

	for (let i = 0; i < tierIds.length; i++) {
		const id = tierIds[i];
		const start = result.tierTimes[i];
		if (start === undefined) continue;
		const end =
			i + 1 < tierIds.length && result.tierTimes[i + 1] !== undefined
				? result.tierTimes[i + 1]
				: (result.agiTime ?? 3600);
		const duration = end - start;
		tierDurations[id] = duration;

		const minDur = validation.tierMinDuration[id];
		const maxDur = validation.tierMaxDuration[id];

		if (minDur && duration < minDur) {
			failures.push(
				`${tiers[i].name} too short: ${duration}s (min: ${minDur}s)`,
			);
		}
		if (maxDur && duration > maxDur) {
			failures.push(
				`${tiers[i].name} too long: ${duration}s (max: ${maxDur}s)`,
			);
		}
	}

	const topGaps = [...result.idle.gaps]
		.sort((a, b) => b.duration - a.duration)
		.slice(0, 5)
		.map((g) => ({
			duration: Math.round(g.duration),
			nextPurchase: g.nextPurchase,
		}));

	return {
		name: profile.name,
		keysPerSec: profile.keysPerSec,
		passed: failures.length === 0,
		agiMinutes,
		purchases: result.purchaseCount,
		longestWait: result.longestWait,
		tiersReached,
		tierDurations,
		failures,
		aiModelsOwned: result.aiModelsOwned,
		idle: {
			totalIdleTime: Math.round(result.idle.totalIdleTime),
			idlePercent: Math.round(result.idle.idlePercent),
			avgGap: Math.round(result.idle.avgGap),
			medianGap: Math.round(result.idle.medianGap),
			topGaps,
		},
	};
}

// ── Output formatters ──

function printHuman(results: ProfileResult[]): void {
	console.log("Flopsed — Balance Check");
	console.log("========================");

	for (const r of results) {
		const label = profiles.find((p) => p.name === r.name)?.label ?? r.name;
		console.log(`\n[${label}]`);

		// AGI time
		if (r.agiMinutes === null) {
			console.log(`  FAIL: AGI never reached in ${validation.agiMaxMinutes} minutes!`);
		} else if (
			r.agiMinutes < validation.agiMinMinutes ||
			r.agiMinutes > validation.agiMaxMinutes
		) {
			console.log(
				`  FAIL: AGI at ${r.agiMinutes.toFixed(1)}min (target: ${validation.agiMinMinutes}-${validation.agiMaxMinutes})`,
			);
		} else {
			console.log(
				`  pass: AGI at ${r.agiMinutes.toFixed(1)}min (target: ${validation.agiMinMinutes}-${validation.agiMaxMinutes})`,
			);
		}

		// Purchases
		if (
			r.purchases < validation.minPurchases ||
			r.purchases > validation.maxPurchases
		) {
			console.log(
				`  FAIL: ${r.purchases} purchases (${validation.minPurchases}-${validation.maxPurchases})`,
			);
		} else {
			console.log(
				`  pass: ${r.purchases} purchases (${validation.minPurchases}-${validation.maxPurchases})`,
			);
		}

		// Longest wait
		if (r.longestWait > validation.maxWaitSeconds) {
			console.log(
				`  FAIL: Longest wait: ${r.longestWait}s (max: ${validation.maxWaitSeconds}s)`,
			);
		} else {
			console.log(
				`  pass: Longest wait: ${r.longestWait}s (max: ${validation.maxWaitSeconds}s)`,
			);
		}

		// Tiers
		if (r.tiersReached < validation.minTiers) {
			console.log(
				`  FAIL: Only ${r.tiersReached} tiers reached (need ${validation.minTiers})`,
			);
		} else {
			console.log(`  pass: All ${r.tiersReached} tiers reached`);
		}

		// Per-tier durations (verbose only)
		if (verbose) {
			const tierIds = tiers.map((t) => t.id);
			for (let i = 0; i < tierIds.length; i++) {
				const id = tierIds[i];
				const duration = r.tierDurations[id];
				if (duration === undefined) continue;
				const minDur = validation.tierMinDuration[id];
				const maxDur = validation.tierMaxDuration[id];

				if (minDur && duration < minDur) {
					console.log(
						`  FAIL: ${tiers[i].name} too short: ${duration}s (min: ${minDur}s)`,
					);
				} else if (maxDur && duration > maxDur) {
					console.log(
						`  FAIL: ${tiers[i].name} too long: ${duration}s (max: ${maxDur}s)`,
					);
				} else {
					console.log(
						`  info: ${tiers[i].name}: ${duration}s (${minDur}-${maxDur}s)`,
					);
				}
			}
			console.log(`  info: AI models owned: ${r.aiModelsOwned}`);
			console.log(
				`  info: Idle time: ${r.idle.totalIdleTime}s (${r.idle.idlePercent}% of session)`,
			);
			console.log(
				`  info: Avg gap: ${r.idle.avgGap}s | Median: ${r.idle.medianGap}s`,
			);
			if (r.idle.topGaps.length > 0) {
				console.log("  info: Top idle gaps:");
				for (const g of r.idle.topGaps) {
					console.log(`    ${g.duration}s → saving for ${g.nextPurchase}`);
				}
			}
		}
	}

	const allPassed = results.every((r) => r.passed);
	console.log(
		`\n${allPassed ? "ALL CHECKS PASSED" : "BALANCE BROKEN — see failures above"}`,
	);
}

function printJson(results: ProfileResult[]): void {
	const output = {
		profiles: results,
		allPassed: results.every((r) => r.passed),
	};
	console.log(JSON.stringify(output, null, 2));
}

// ── Main ──

const selectedProfiles = profileFlag
	? profiles.filter((p) => p.name === profileFlag)
	: profiles;

if (profileFlag && selectedProfiles.length === 0) {
	console.error(
		`Unknown profile: ${profileFlag}. Available: ${profiles.map((p) => p.name).join(", ")}`,
	);
	process.exit(1);
}

if (traceOutput) {
	// Trace mode: run selected profiles and dump enriched purchase timelines
	const traceProfiles = selectedProfiles;
	const traceResults = traceProfiles.map((p) => {
		const result: SimResult = runBalanceSim(simData, {
			keysPerSec: p.keysPerSec,
			skill: p.skill,
			maxMinutes: 90,
		});
		return {
			profile: p.name,
			keysPerSec: p.keysPerSec,
			purchases: result.purchases,
			snapshots: result.snapshots,
			tierTimes: result.tierTimes,
			agiTime: result.agiTime,
		};
	});
	// Single profile: output object directly; multiple: output array
	const output = traceResults.length === 1 ? traceResults[0] : traceResults;
	console.log(JSON.stringify(output, null, 2));
	process.exit(0);
}

const results = selectedProfiles.map(validateProfile);

if (jsonOutput) {
	printJson(results);
} else {
	printHuman(results);
}

const allPassed = results.every((r) => r.passed);
process.exit(allPassed ? 0 : 1);
