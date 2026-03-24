const BASE = "/api";

export async function fetchData<T>(file: string): Promise<T> {
	const res = await fetch(`${BASE}/data/${file}`);
	if (!res.ok) throw new Error(`Failed to fetch ${file}`);
	return res.json();
}

export async function saveData(file: string, data: unknown): Promise<void> {
	const res = await fetch(`${BASE}/data/${file}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Unknown error" }));
		throw new Error(err.error);
	}
}

export interface BalanceCheckResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export async function runBalanceCheck(): Promise<BalanceCheckResult> {
	const res = await fetch(`${BASE}/balance-check`, { method: "POST" });
	return res.json();
}
