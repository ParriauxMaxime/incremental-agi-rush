# LLM Model Tech Tree — Design Spec

## Overview

Add named, historical LLM models as tech tree nodes in the AI Lab tier. Two model families (OpenAI, Anthropic) branch from the existing `llm_gate`, each with a linear progression and one branch point. Each tech tree node unlocks a corresponding model entry in `ai-models.json` for deployment.

This spec focuses on the **tech tree gating layer** — the model data in `ai-models.json` already defines stats, traits, and agent setups. We are adding GPT-3, GPT-3.5, GPT-4.1, and Claude Haiku as new earlier models, and wiring all models through the tech tree instead of direct purchase.

## Tree Structure

```
llm_gate ("LLM Research")  [existing, unchanged]
│
├── openai_gpt3 ("GPT-3")
│   └── openai_gpt35 ("GPT-3.5")
│       └── openai_gpt4 ("GPT-4")           [existing model in ai-models.json]
│           ├── openai_gpt41 ("GPT-4.1")
│           └── openai_gpt5 ("GPT-5")       [existing model in ai-models.json]
│
└── anthropic_haiku ("Claude Haiku")
    └── anthropic_sonnet ("Claude Sonnet")   [existing model in ai-models.json]
        └── anthropic_opus ("Claude Opus")   [existing model in ai-models.json]
```

Each node is a one-time tech tree unlock (max: 1, paid in cash). Unlocking a node makes that model available for deployment. Models still cost cash to deploy (the cost in `ai-models.json`).

## Model Stats

Stats for models already in `ai-models.json` (GPT-4, GPT-5, Claude Sonnet, Claude Opus) remain as-is. New models are added to `ai-models.json` following the same schema.

### New Models (to add to ai-models.json)

| Model | ID | LoC/s | FLOPS Cost | Quality | Cost (deploy) | Trait |
|-------|-----|-------|------------|---------|---------------|-------|
| GPT-3 | `gpt_3` | 500 | 800 | 70% | $2M | "Verbose" — +30% LoC/s but 30% reduced cash (same as GPT-4 trait) |
| GPT-3.5 | `gpt_35` | 1,500 | 1,500 | 78% | $5M | "ChatGPT moment" — timed cash buff: +10% cash multiplier for 60s on deploy |
| GPT-4.1 | `gpt_41` | 10,000 | 3,500 | 88% | $50M | "Efficient" — FLOPS cost for this model is 20% lower than listed (effective: 2,800) |
| Claude Haiku | `claude_haiku` | 800 | 400 | 82% | $5M | "Fast & cheap" — best FLOPS/LoC ratio in the game |

### Existing Models (unchanged in ai-models.json)

| Model | ID | LoC/s | FLOPS Cost | Quality | Cost | Notes |
|-------|-----|-------|------------|---------|------|-------|
| GPT-4 | `gpt_4` | 8,000 | 3,000 | 85% | $25M | Already exists, gets `requires: "gpt_35"` added |
| GPT-5 | `gpt_5` | 60,000 | 15,000 | 88% | $500M | Already exists, `requires` changes from `"gpt_4"` to `"gpt_4"` (unchanged) |
| Claude Sonnet | `claude_sonnet` | 5,000 | 2,000 | 95% | $15M | Already exists, gets `requires: "claude_haiku"` added |
| Claude Opus | `claude_opus` | 20,000 | 6,000 | 98% | $200M | Already exists, unchanged |

### Design Intent

- **OpenAI** = raw throughput, more models to chain, cheaper early entry
- **Anthropic** = quality-focused, fewer models, higher quality floors, efficient FLOPS
- **GPT-4.1 vs GPT-5** = cost-efficient incremental ($50M, 10K LoC/s) vs expensive powerhouse ($500M, 60K LoC/s)
- Both families complement each other; agent setups (Swarm, Pipeline, etc.) incentivize owning models from both

## Tech Tree Nodes

Each tech tree node unlocks the corresponding model. Node costs are separate from deployment costs — the tree cost is the "research" investment, the `ai-models.json` cost is the "deployment" investment.

| Node ID | Name | Icon | Requires | Unlock Cost | Currency |
|---------|------|------|----------|-------------|----------|
| `openai_gpt3` | GPT-3 | 🟢 | `llm_gate` | $500K | cash |
| `openai_gpt35` | GPT-3.5 | 🟢 | `openai_gpt3` | $1.5M | cash |
| `openai_gpt4` | GPT-4 | 🟢 | `openai_gpt35` | $5M | cash |
| `openai_gpt41` | GPT-4.1 | 🟢 | `openai_gpt4` | $12M | cash |
| `openai_gpt5` | GPT-5 | 🟢 | `openai_gpt4` | $30M | cash |
| `anthropic_haiku` | Claude Haiku | 🟠 | `llm_gate` | $800K | cash |
| `anthropic_sonnet` | Claude Sonnet | 🟠 | `anthropic_haiku` | $5M | cash |
| `anthropic_opus` | Claude Opus | 🟠 | `anthropic_sonnet` | $25M | cash |

### Node Effect

Each node uses a new effect type `modelUnlock` that makes the corresponding model available:

```json
{
  "type": "modelUnlock",
  "op": "enable",
  "value": "gpt_3"
}
```

## Changes to Existing Data

### `specs/data/ai-models.json`

- **Add** 4 new models: `gpt_3`, `gpt_35`, `gpt_41`, `claude_haiku`
- **Update** `gpt_4`: add `"requires": "gpt_35"`
- **Update** `claude_sonnet`: add `"requires": "claude_haiku"`
- **Keep** all other models (Copilot, Gemini, Llama, Mistral, Grok) — they remain directly purchasable for now. When future families get their own tech tree branches, those models will be gated the same way.

### `specs/data/tech-tree.json`

- **Add** 8 new nodes (listed above)

### `specs/data/upgrades.json`

- **Remove** `llm_instance` — models are now deployed via `ai-models.json`, not as generic instances

### `llm_capacity` Tech Node

The existing `llm_capacity` ("GPU Allocation", +5 max LLM instances per level) **remains unchanged**. It governs how many total models can be deployed simultaneously. With 8 models available across 2 families (plus existing Copilot, Gemini, etc.), the capacity limit creates a meaningful choice about which models to keep running.

## New Effect Types

| Effect Type | Used By | Scope | Description |
|---|---|---|---|
| `modelUnlock` | All 8 tree nodes | Per-model | Enables a specific model for deployment |
| `timedCashMultiplier` | GPT-3.5 | Global, temporary | Multiplies all cash income by value for `duration` seconds. Triggers once on deploy. Fields: `value: 1.1`, `duration: 60` |

### Traits Using Existing ai-models.json Special Fields

The trait system already exists in `ai-models.json` via the `special` object. No new effect types are needed for most traits:

- **Verbose** (GPT-3, GPT-4): `locBonus` + `cashPenalty` — already defined on GPT-4
- **Quality floor** (Claude Sonnet): `minQuality` — already defined
- **Self-review** (Claude Opus): `globalQualityBonus` — already defined
- **Efficient** (GPT-4.1): new field `flopsCostMultiplier: 0.8` on the model's `special` object

### Stacking Rules

- `globalQualityBonus` stacks additively. If player owns both Claude Opus (+5%) and buys a future model with the same trait, bonuses add.
- `minQuality` (quality floors) take the highest value across all owned models. E.g., if Claude Sonnet sets floor at 80% and GPT-4 sets it at 75%, the effective floor is 80%.
- These interact with the Testing Suite quality floors from `balance.json` — the effective floor is `max(testingSuiteFloor, modelFloor)`.

## Dependencies

- **Quality system (separate spec, ships first)** — without it, quality ratings, `minQuality`, and `globalQualityBonus` are inert. Models can still be added and produce LoC; quality traits activate once the system lands.

## Balance Notes

After implementation, run `cd specs && node balance-check.js` to validate:
- AGI still reachable in 33-50 minutes
- No stall points where players can't afford the next model
- Early models (GPT-3, Haiku) are affordable shortly after entering AI Lab tier
- The two-cost structure (tree unlock + deploy) doesn't create excessive cost walls

The balance sim will need updating to account for the two-cost purchase flow (tree node then model deploy).

## Future Expansion

Additional families get their own tech tree branches from `llm_gate`, gating models that already exist in `ai-models.json`:
- Meta: Llama 70B → 405B
- Mistral: Large
- Google: Gemini Pro → Ultra
- xAI: Grok 2 → 3
- Copilot gets a standalone node (no chain, single unlock)
