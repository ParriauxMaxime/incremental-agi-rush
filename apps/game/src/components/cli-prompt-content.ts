// ── Claude Code-style prompt editor content pools ──
// Purely cosmetic — no game mechanics. Used by cli-prompt.tsx.

export interface EditSnippet {
	file: string;
	description: string;
	lines: Array<{ type: "add" | "remove" | "context"; text: string }>;
}

export interface ReadSnippet {
	file: string;
	lines: string[];
}

export interface WriteSnippet {
	file: string;
	lines: string[];
}

export interface BashSnippet {
	command: string;
	output: string[];
}

export interface ActionStep {
	type: "think" | "read" | "edit" | "write" | "bash" | "respond" | "complete";
	snippet?: EditSnippet | ReadSnippet | WriteSnippet | BashSnippet;
	text?: string;
}

// ── Action patterns ──

export type PatternId =
	| "simple_edit"
	| "read_edit"
	| "bash_edit"
	| "new_file"
	| "code_review"
	| "test_fix";

interface PatternDef {
	id: PatternId;
	weight: number;
	build: () => ActionStep[];
}

function pick<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

const PATTERNS: PatternDef[] = [
	{
		id: "simple_edit",
		weight: 30,
		build: () => [
			{ type: "think" },
			{ type: "edit", snippet: pick(EDIT_SNIPPETS) },
			{ type: "respond", text: pick(RESPONSE_TEXTS) },
			{ type: "complete" },
		],
	},
	{
		id: "read_edit",
		weight: 30,
		build: () => [
			{ type: "think" },
			{ type: "read", snippet: pick(READ_SNIPPETS) },
			{ type: "edit", snippet: pick(EDIT_SNIPPETS) },
			{ type: "respond", text: pick(RESPONSE_TEXTS) },
			{ type: "complete" },
		],
	},
	{
		id: "bash_edit",
		weight: 15,
		build: () => [
			{ type: "think" },
			{ type: "bash", snippet: pick(BASH_SNIPPETS) },
			{ type: "edit", snippet: pick(EDIT_SNIPPETS) },
			{ type: "respond", text: pick(RESPONSE_TEXTS) },
			{ type: "complete" },
		],
	},
	{
		id: "new_file",
		weight: 10,
		build: () => [
			{ type: "think" },
			{ type: "write", snippet: pick(WRITE_SNIPPETS) },
			{ type: "respond", text: pick(RESPONSE_TEXTS) },
			{ type: "complete" },
		],
	},
	{
		id: "code_review",
		weight: 10,
		build: () => [
			{ type: "think" },
			{ type: "read", snippet: pick(READ_SNIPPETS) },
			{ type: "respond", text: pick(RESPONSE_TEXTS) },
			{ type: "complete" },
		],
	},
	{
		id: "test_fix",
		weight: 5,
		build: () => [
			{ type: "think" },
			{ type: "bash", snippet: BASH_TEST_FAIL },
			{ type: "edit", snippet: pick(EDIT_SNIPPETS) },
			{ type: "bash", snippet: BASH_TEST_PASS },
			{ type: "respond", text: pick(RESPONSE_TEXTS) },
			{ type: "complete" },
		],
	},
];

export function pickPattern(): ActionStep[] {
	const totalWeight = PATTERNS.reduce((s, p) => s + p.weight, 0);
	let r = Math.random() * totalWeight;
	for (const p of PATTERNS) {
		r -= p.weight;
		if (r <= 0) return p.build();
	}
	return PATTERNS[0].build();
}

// ── Edit snippets ──

const EDIT_SNIPPETS: readonly EditSnippet[] = [
	{
		file: "src/lib/api-client.ts",
		description: "Add retry logic to API client",
		lines: [
			{ type: "context", text: "async function fetchData(url: string) {" },
			{ type: "remove", text: "  const res = await fetch(url);" },
			{ type: "add", text: "  const res = await fetchWithRetry(url, 3);" },
			{ type: "context", text: "  return res.json();" },
		],
	},
	{
		file: "src/components/auth-form.tsx",
		description: "Fix form validation",
		lines: [
			{ type: "context", text: "const handleSubmit = async () => {" },
			{ type: "add", text: "  if (!email || !password) {" },
			{ type: "add", text: '    setError("All fields required");' },
			{ type: "add", text: "    return;" },
			{ type: "add", text: "  }" },
			{ type: "context", text: "  await login(email, password);" },
		],
	},
	{
		file: "src/hooks/use-session.ts",
		description: "Add token refresh",
		lines: [
			{ type: "context", text: "useEffect(() => {" },
			{ type: "add", text: "  const interval = setInterval(() => {" },
			{ type: "add", text: "    refreshToken();" },
			{ type: "add", text: "  }, 5 * 60 * 1000);" },
			{ type: "add", text: "  return () => clearInterval(interval);" },
			{ type: "context", text: "}, []);" },
		],
	},
	{
		file: "src/middleware/rate-limiter.ts",
		description: "Increase rate limit window",
		lines: [
			{ type: "remove", text: "const WINDOW_MS = 60_000;" },
			{ type: "add", text: "const WINDOW_MS = 300_000;" },
			{ type: "remove", text: "const MAX_REQUESTS = 100;" },
			{ type: "add", text: "const MAX_REQUESTS = 500;" },
		],
	},
	{
		file: "src/utils/format.ts",
		description: "Fix number formatting edge case",
		lines: [
			{ type: "context", text: "export function formatCurrency(n: number) {" },
			{ type: "add", text: "  if (Number.isNaN(n)) return '$0.00';" },
			{ type: "context", text: "  return `$${n.toFixed(2)}`;" },
		],
	},
	{
		file: "src/store/app-store.ts",
		description: "Add loading state",
		lines: [
			{ type: "context", text: "interface AppState {" },
			{ type: "add", text: "  isLoading: boolean;" },
			{ type: "add", text: "  error: string | null;" },
			{ type: "context", text: "  user: User | null;" },
		],
	},
	{
		file: "src/components/dashboard.tsx",
		description: "Extract metrics component",
		lines: [
			{ type: "remove", text: "  const metrics = computeMetrics(data);" },
			{
				type: "remove",
				text: "  return <div>{metrics.map(renderMetric)}</div>;",
			},
			{ type: "add", text: "  return <MetricsPanel data={data} />;" },
		],
	},
	{
		file: "src/lib/database.ts",
		description: "Add connection pooling",
		lines: [
			{ type: "remove", text: "const db = new Database(config.dbUrl);" },
			{ type: "add", text: "const pool = new Pool({" },
			{ type: "add", text: "  connectionString: config.dbUrl," },
			{ type: "add", text: "  max: 20," },
			{ type: "add", text: "  idleTimeoutMillis: 30000," },
			{ type: "add", text: "});" },
		],
	},
	{
		file: "config/webpack.config.js",
		description: "Enable source maps for production",
		lines: [
			{ type: "remove", text: "  devtool: false," },
			{ type: "add", text: "  devtool: 'hidden-source-map'," },
		],
	},
	{
		file: "src/services/notifications.ts",
		description: "Add exponential backoff",
		lines: [
			{ type: "context", text: "async function send(msg: Message) {" },
			{
				type: "add",
				text: "  for (let attempt = 0; attempt < 3; attempt++) {",
			},
			{ type: "add", text: "    try { return await deliver(msg); }" },
			{ type: "add", text: "    catch { await sleep(2 ** attempt * 1000); }" },
			{ type: "add", text: "  }" },
			{ type: "context", text: "}" },
		],
	},
];

// ── Read snippets ──

const READ_SNIPPETS: readonly ReadSnippet[] = [
	{
		file: "src/config/env.ts",
		lines: [
			"export const config = {",
			"  apiUrl: process.env.API_URL ?? 'http://localhost:3000',",
			"  debug: process.env.DEBUG === 'true',",
			"  maxRetries: 3,",
			"};",
		],
	},
	{
		file: "src/types/models.ts",
		lines: [
			"export interface User {",
			"  id: string;",
			"  email: string;",
			"  role: 'admin' | 'user';",
			"}",
		],
	},
	{
		file: "tests/setup.ts",
		lines: [
			"import { beforeAll, afterAll } from 'vitest';",
			"beforeAll(async () => { await db.connect(); });",
			"afterAll(async () => { await db.disconnect(); });",
		],
	},
	{
		file: "package.json",
		lines: [
			'"scripts": {',
			'  "dev": "next dev",',
			'  "build": "next build",',
			'  "test": "vitest run"',
			"}",
		],
	},
	{
		file: "src/middleware/auth.ts",
		lines: [
			"export function requireAuth(req: Request) {",
			"  const token = req.headers.get('authorization');",
			"  if (!token) throw new UnauthorizedError();",
			"  return verifyJWT(token);",
			"}",
		],
	},
];

// ── Write snippets ──

const WRITE_SNIPPETS: readonly WriteSnippet[] = [
	{
		file: "tests/unit/api-client.test.ts",
		lines: [
			"import { describe, it, expect } from 'vitest';",
			"import { fetchData } from '../../src/lib/api-client';",
			"",
			"describe('fetchData', () => {",
			"  it('retries on failure', async () => {",
			"    const data = await fetchData('/api/test');",
			"    expect(data).toBeDefined();",
			"  });",
			"});",
		],
	},
	{
		file: "src/components/error-boundary.tsx",
		lines: [
			"import { Component, type ReactNode } from 'react';",
			"",
			"interface Props { children: ReactNode; fallback?: ReactNode; }",
			"interface State { hasError: boolean; }",
			"",
			"export class ErrorBoundary extends Component<Props, State> {",
			"  state: State = { hasError: false };",
			"  static getDerivedStateFromError() { return { hasError: true }; }",
			"  render() {",
			"    if (this.state.hasError) return this.props.fallback ?? <p>Error</p>;",
			"    return this.props.children;",
			"  }",
			"}",
		],
	},
	{
		file: "src/utils/debounce.ts",
		lines: [
			"export function debounce<T extends (...args: unknown[]) => void>(",
			"  fn: T, ms: number",
			"): T {",
			"  let timer: ReturnType<typeof setTimeout>;",
			"  return ((...args: unknown[]) => {",
			"    clearTimeout(timer);",
			"    timer = setTimeout(() => fn(...args), ms);",
			"  }) as T;",
			"}",
		],
	},
	{
		file: "config/database.yml",
		lines: [
			"production:",
			"  host: db.internal",
			"  port: 5432",
			"  pool: 20",
			"  ssl: true",
		],
	},
];

// ── Bash snippets ──

const BASH_SNIPPETS: readonly BashSnippet[] = [
	{
		command: "npm test",
		output: ["", "✓ 47 tests passing (1.2s)", ""],
	},
	{
		command: "npx tsc --noEmit",
		output: ["", "No errors found.", ""],
	},
	{
		command: "git diff --stat",
		output: [
			" src/lib/api-client.ts | 12 ++++----",
			" src/hooks/use-session.ts | 8 ++++++",
			" 2 files changed, 14 insertions(+), 6 deletions(-)",
		],
	},
	{
		command: "npm run build",
		output: [
			"Building...",
			"✓ Compiled successfully in 3.2s",
			"  Bundle: 847kb (gzipped: 234kb)",
		],
	},
	{
		command: "curl -s localhost:3000/health | jq .",
		output: ['{ "status": "ok", "uptime": 84723 }'],
	},
	{
		command: "git status",
		output: [
			"On branch main",
			"Changes not staged for commit:",
			"  modified: src/lib/api-client.ts",
		],
	},
	{
		command: "npm run lint",
		output: ["", "✓ No lint errors found", ""],
	},
];

const BASH_TEST_FAIL: BashSnippet = {
	command: "npm test -- --run",
	output: [
		"FAIL src/lib/api-client.test.ts",
		"  ✕ retries on failure (12ms)",
		"    Expected: 3 retries",
		"    Received: 0",
		"",
		"Tests: 1 failed, 46 passed",
	],
};

const BASH_TEST_PASS: BashSnippet = {
	command: "npm test -- --run",
	output: ["", "✓ 47 tests passing (1.4s)", ""],
};

// ── Response texts ──

const RESPONSE_TEXTS: readonly string[] = [
	"I've refactored the function to handle edge cases properly. The retry logic should prevent intermittent failures.",
	"Fixed the validation — it now checks all required fields before submission.",
	"The token refresh is set up with a 5-minute interval. Sessions should stay alive now.",
	"I've extracted the metrics into a dedicated component. The dashboard is cleaner now.",
	"Added connection pooling with a max of 20 connections. This should handle the load better.",
	"The source maps are now enabled for production builds. Debugging should be easier.",
	"I've added exponential backoff to the notification service. It'll retry up to 3 times with increasing delays.",
	"The rate limiter window has been increased. This should reduce false positives for active users.",
	"Updated the config to use environment variables with sensible defaults.",
	"I've added a comprehensive test suite for the API client. All edge cases are covered.",
	"The error boundary will catch rendering errors and show a fallback UI instead of crashing.",
	"Debounce utility is ready — it handles cleanup properly and preserves the function signature.",
	"The auth middleware now validates tokens properly. Invalid tokens get a 401 immediately.",
	"I've optimized the database queries. The N+1 problem should be resolved now.",
	"Added proper TypeScript types for the API responses. The compiler will catch misuse early.",
	"The caching layer is in place. Repeated requests hit memory first, then fall back to the API.",
	"I've split the monolithic component into three focused ones. Each has a single responsibility now.",
	"The migration script handles both up and down. Rolling back should be safe.",
	"CSS modules are set up. No more global style conflicts between components.",
	"The WebSocket reconnection logic handles backoff and message queuing during disconnects.",
];

// ── Auto-prompt suggestions ──

export const AUTO_PROMPTS: readonly string[] = [
	"Refactor the attention mechanism",
	"Add chain-of-thought reasoning",
	"Optimize the training loop",
	"Implement RLHF pipeline",
	"Scale to 2048 GPUs",
	"Fix the alignment loss function",
	"Add mixture of experts routing",
	"Implement self-reflection module",
	"Build autonomous agent framework",
	"Deploy world model predictor",
	"Compress the tokenizer vocabulary",
	"Profile memory bottlenecks",
	"Add safety guardrails",
	"Improve benchmark evaluation",
	"Implement emergent capability detection",
	"Upgrade to flash attention",
	"Add speculative decoding",
	"Tune hyperparameters",
	"Build data preprocessing pipeline",
	"Implement tool-use capabilities",
	"Fix the gradient accumulation bug",
	"Add distributed checkpointing",
	"Optimize inference throughput",
	"Implement KV-cache compression",
];
