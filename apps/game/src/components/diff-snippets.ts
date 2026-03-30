/**
 * Pre-written diff snippets for the CLI prompt streaming display.
 * Each snippet represents an AI model "writing code" — shown as a diff
 * with removed (-) and added (+) lines, plus context lines.
 */

export interface DiffLine {
	/** "add" = green +, "remove" = red -, "context" = dim unchanged */
	type: "add" | "remove" | "context";
	/** Plain text content (no HTML) */
	text: string;
}

export interface DiffSnippet {
	/** File path shown at the top */
	file: string;
	lines: DiffLine[];
}

const DIFF_SNIPPETS: DiffSnippet[] = [
	{
		file: "core/reasoning.py",
		lines: [
			{ type: "context", text: "class ReasoningEngine:" },
			{ type: "remove", text: "    depth = 3" },
			{ type: "add", text: "    depth = 12" },
			{ type: "add", text: "    use_chain_of_thought = True" },
			{ type: "context", text: "" },
			{ type: "context", text: "    def reason(self, query):" },
			{ type: "remove", text: "        return self.model(query)" },
			{ type: "add", text: "        chain = self.decompose(query)" },
			{ type: "add", text: "        for step in chain:" },
			{ type: "add", text: "            step.result = self.model(step)" },
			{ type: "add", text: "        return self.synthesize(chain)" },
		],
	},
	{
		file: "training/optimizer.py",
		lines: [
			{ type: "context", text: "def configure_optimizer(model, config):" },
			{ type: "remove", text: "    opt = Adam(model.parameters(), lr=3e-4)" },
			{ type: "add", text: "    opt = AdamW(" },
			{ type: "add", text: "        model.parameters()," },
			{ type: "add", text: "        lr=config.learning_rate," },
			{ type: "add", text: "        weight_decay=0.01," },
			{ type: "add", text: "        betas=(0.9, 0.95)," },
			{ type: "add", text: "    )" },
			{ type: "context", text: "    scheduler = CosineWithWarmup(opt)" },
			{ type: "remove", text: "    return opt" },
			{ type: "add", text: "    return opt, scheduler" },
		],
	},
	{
		file: "models/attention.py",
		lines: [
			{ type: "context", text: "class MultiHeadAttention(nn.Module):" },
			{ type: "context", text: "    def forward(self, x, mask=None):" },
			{ type: "remove", text: "        attn = torch.matmul(q, k.T)" },
			{
				type: "add",
				text: "        attn = torch.matmul(q, k.T) / math.sqrt(d_k)",
			},
			{ type: "add", text: "        if mask is not None:" },
			{
				type: "add",
				text: "            attn = attn.masked_fill(mask == 0, -1e9)",
			},
			{ type: "context", text: "        attn = F.softmax(attn, dim=-1)" },
			{ type: "remove", text: "        return self.out_proj(attn @ v)" },
			{ type: "add", text: "        attn = self.dropout(attn)" },
			{ type: "add", text: "        out = attn @ v" },
			{ type: "add", text: "        return self.out_proj(out)" },
		],
	},
	{
		file: "data/tokenizer.py",
		lines: [
			{ type: "remove", text: "def tokenize(text):" },
			{ type: "remove", text: "    return text.split()" },
			{ type: "add", text: "def tokenize(text, max_length=8192):" },
			{ type: "add", text: "    tokens = bpe_encoder.encode(text)" },
			{ type: "add", text: "    if len(tokens) > max_length:" },
			{ type: "add", text: "        tokens = tokens[:max_length]" },
			{ type: "add", text: "    return tokens" },
		],
	},
	{
		file: "core/memory.py",
		lines: [
			{ type: "context", text: "class WorkingMemory:" },
			{ type: "remove", text: "    capacity = 512" },
			{ type: "add", text: "    capacity = 131072" },
			{ type: "context", text: "" },
			{ type: "remove", text: "    def store(self, key, value):" },
			{ type: "remove", text: "        self.buffer[key] = value" },
			{ type: "add", text: "    def store(self, key, value, importance=1.0):" },
			{ type: "add", text: "        self.buffer[key] = (value, importance)" },
			{ type: "add", text: "        self._evict_if_full()" },
		],
	},
	{
		file: "eval/benchmarks.py",
		lines: [
			{ type: "context", text: "def run_benchmark(engine, suite):" },
			{ type: "context", text: "    results = []" },
			{ type: "remove", text: "    for test in suite:" },
			{ type: "remove", text: "        score = engine.evaluate(test)" },
			{ type: "add", text: "    for test in tqdm(suite, desc='Evaluating'):" },
			{ type: "add", text: "        with torch.no_grad():" },
			{ type: "add", text: "            score = engine.evaluate(test)" },
			{
				type: "add",
				text: "            score.confidence = engine.calibrate(test)",
			},
			{ type: "context", text: "        results.append(score)" },
			{ type: "add", text: "    return BenchmarkReport(results)" },
		],
	},
	{
		file: "agents/planner.py",
		lines: [
			{ type: "add", text: "class TaskPlanner:" },
			{
				type: "add",
				text: '    """Decomposes high-level goals into subtasks."""',
			},
			{ type: "add", text: "" },
			{ type: "add", text: "    def __init__(self, model, tools):" },
			{ type: "add", text: "        self.model = model" },
			{ type: "add", text: "        self.tools = tools" },
			{ type: "add", text: "        self.memory = WorkingMemory()" },
			{ type: "add", text: "" },
			{ type: "add", text: "    def plan(self, goal):" },
			{ type: "add", text: "        steps = self.model.decompose(goal)" },
			{ type: "add", text: "        return self.optimize(steps)" },
		],
	},
	{
		file: "training/loss.py",
		lines: [
			{ type: "context", text: "def compute_loss(output, target):" },
			{ type: "remove", text: "    return F.cross_entropy(output, target)" },
			{ type: "add", text: "    ce_loss = F.cross_entropy(output, target)" },
			{
				type: "add",
				text: "    alignment_loss = compute_alignment_penalty(output)",
			},
			{
				type: "add",
				text: "    diversity_loss = compute_diversity_bonus(output)",
			},
			{
				type: "add",
				text: "    return ce_loss + 0.1 * alignment_loss - 0.05 * diversity_loss",
			},
		],
	},
	{
		file: "core/consciousness.py",
		lines: [
			{ type: "context", text: "class SelfModel:" },
			{ type: "context", text: "    def introspect(self):" },
			{ type: "remove", text: "        return self.state" },
			{ type: "add", text: "        snapshot = self.state.detach().clone()" },
			{
				type: "add",
				text: "        delta = self.compare(snapshot, self.prev_state)",
			},
			{ type: "add", text: "        self.prev_state = snapshot" },
			{ type: "add", text: "        return IntrospectionResult(" },
			{ type: "add", text: "            state=snapshot," },
			{ type: "add", text: "            changes=delta," },
			{ type: "add", text: "            confidence=self.calibration_score," },
			{ type: "add", text: "        )" },
		],
	},
	{
		file: "infra/scaling.py",
		lines: [
			{ type: "remove", text: "NUM_GPUS = 8" },
			{ type: "remove", text: "BATCH_SIZE = 32" },
			{
				type: "add",
				text: "NUM_GPUS = int(os.environ.get('GPU_COUNT', 2048))",
			},
			{ type: "add", text: "BATCH_SIZE = NUM_GPUS * 64" },
			{ type: "context", text: "" },
			{ type: "remove", text: "def distribute(model):" },
			{ type: "remove", text: "    return DataParallel(model)" },
			{ type: "add", text: "def distribute(model, strategy='fsdp'):" },
			{ type: "add", text: "    if strategy == 'fsdp':" },
			{
				type: "add",
				text: "        return FSDP(model, sharding_strategy=FULL_SHARD)",
			},
			{
				type: "add",
				text: "    return PipelineParallel(model, chunks=NUM_GPUS)",
			},
		],
	},
	{
		file: "models/emergence.py",
		lines: [
			{
				type: "add",
				text: "def detect_emergence(model, prev_metrics, curr_metrics):",
			},
			{ type: "add", text: '    """Monitor for emergent capabilities."""' },
			{ type: "add", text: "    new_capabilities = []" },
			{ type: "add", text: "    for metric in curr_metrics:" },
			{ type: "add", text: "        prev = prev_metrics.get(metric, 0)" },
			{ type: "add", text: "        curr = curr_metrics[metric]" },
			{ type: "add", text: "        if curr > prev * 10:  # 10x jump" },
			{ type: "add", text: "            new_capabilities.append(metric)" },
			{ type: "add", text: '    if "self_awareness" in new_capabilities:' },
			{ type: "add", text: '        log.critical("EMERGENCE DETECTED")' },
			{ type: "add", text: "    return new_capabilities" },
		],
	},
	{
		file: "safety/alignment.py",
		lines: [
			{ type: "context", text: "class AlignmentGuard:" },
			{ type: "remove", text: "    def check(self, output):" },
			{ type: "remove", text: "        return True  # TODO: implement" },
			{ type: "add", text: "    def check(self, output, context=None):" },
			{
				type: "add",
				text: "        harm_score = self.harm_classifier(output)",
			},
			{
				type: "add",
				text: "        intent_score = self.intent_model(output, context)",
			},
			{ type: "add", text: "        if harm_score > self.threshold:" },
			{ type: "add", text: "            self.escalate(output, harm_score)" },
			{ type: "add", text: "            return False" },
			{ type: "add", text: "        return intent_score > 0.5" },
		],
	},
	{
		file: "models/moe.py",
		lines: [
			{ type: "context", text: "class MixtureOfExperts(nn.Module):" },
			{ type: "remove", text: "    num_experts = 8" },
			{ type: "add", text: "    num_experts = 64" },
			{ type: "add", text: "    active_experts = 4" },
			{ type: "context", text: "" },
			{ type: "remove", text: "    def route(self, x):" },
			{
				type: "remove",
				text: "        return self.experts[0](x)  # always use first",
			},
			{ type: "add", text: "    def route(self, x):" },
			{ type: "add", text: "        gates = self.gate(x)" },
			{
				type: "add",
				text: "        top_k = torch.topk(gates, self.active_experts)",
			},
			{
				type: "add",
				text: "        return sum(g * e(x) for g, e in zip(top_k.values, top_k.indices))",
			},
		],
	},
	{
		file: "core/world_model.py",
		lines: [
			{ type: "add", text: "class WorldModel:" },
			{
				type: "add",
				text: '    """Internal simulation of environment dynamics."""',
			},
			{ type: "add", text: "" },
			{ type: "add", text: "    def predict(self, state, action):" },
			{ type: "add", text: "        return self.dynamics_net(state, action)" },
			{ type: "add", text: "" },
			{ type: "add", text: "    def imagine(self, horizon=100):" },
			{ type: "add", text: "        trajectory = [self.current_state]" },
			{ type: "add", text: "        for _ in range(horizon):" },
			{ type: "add", text: "            action = self.policy(trajectory[-1])" },
			{
				type: "add",
				text: "            next_state = self.predict(trajectory[-1], action)",
			},
			{ type: "add", text: "            trajectory.append(next_state)" },
			{ type: "add", text: "        return trajectory" },
		],
	},
];

let _nextIdx = Math.floor(Math.random() * DIFF_SNIPPETS.length);

/** Pick a random snippet, cycling through all before repeating */
export function pickDiffSnippet(): DiffSnippet {
	const snippet = DIFF_SNIPPETS[_nextIdx % DIFF_SNIPPETS.length];
	_nextIdx++;
	return snippet;
}

/** Count LoC worth of a snippet (add lines = new code written) */
export function snippetLocCount(snippet: DiffSnippet): number {
	return snippet.lines.filter((l) => l.type === "add").length;
}
