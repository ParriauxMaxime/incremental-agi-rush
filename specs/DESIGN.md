# AGI Rush — Game Design Document

## Core Concept

An incremental game where you type code, execute it for cash, and scale up toward AGI.
The meta layer: you're building the thing that replaces you.

---

## Resources

### Primary

| Resource | Symbol | How you get it | How you spend it |
|----------|--------|----------------|------------------|
| **Lines of Code (LoC)** | `< >` | Typing (manual) or AI (auto) | Executed by FLOPS → produces cash |
| **Cash ($)** | `$` | Executing LoC | Buy upgrades, hire, scale |
| **FLOPS** | `⚡` | Hardware upgrades | Executes LoC *and* powers AI |

### The Loop

```
 [Type / AI writes] → LoC enters codebase
                          ↓
                FLOPS execute LoC (consumed)
                          ↓
                    Cash is generated
                          ↓
              Cash buys upgrades / hardware
                          ↓
              More FLOPS, better AI, repeat
```

### FLOPS as Shared Resource

FLOPS is the central bottleneck. It starts very low (1 FLOP = 1 LoC executed/s).
Early game: the player types LoC manually, FLOPS are only used for execution.
That's straightforward — more hardware = faster cash.

**The twist comes with AI (Tier 4+).** AI auto-writes LoC but *also consumes FLOPS to do it.*
Now FLOPS must be split between two competing demands:

```
Total FLOPS Available
    ├── Execution FLOPS  →  runs LoC → generates cash
    └── AI FLOPS         →  writes LoC → fills the queue
```

**Player decisions:**
- Buy more FLOPS (hardware) to feed both
- Balance the allocation — too much AI = code piles up unexecuted, too much execution = idle with no code to run
- The AI slider / allocation becomes a core late-game mechanic

**Scaling curve:**
- **Tier 0-1:** FLOPS are scarce, only used for execution. Player is the bottleneck (typing).
- **Tier 2-3:** Devs auto-write LoC (no FLOPS cost — they're humans). FLOPS scale for execution only. Comfortable growth.
- **Tier 4:** AI arrives. Suddenly FLOPS have two jobs. The player feels the crunch again.
- **Tier 5:** Massive FLOPS needed. The numbers go exponential. Classic incremental endgame.

**Key tension:** LoC is *consumed* on execution. You need a steady supply.
If FLOPS > LoC production → you're bottlenecked on code.
If LoC production > FLOPS → code piles up, cash stalls.
Balancing both streams is the game.
**Post-AI:** Even with infinite LoC generation, you need FLOPS for both — the bottleneck never fully goes away, it just shifts.

### FLOPS Allocation Slider (unlocks Tier 4)

A slider appears in the sidebar when AI is first purchased. Ranges from 0% to 100%.

```
  [Execution] ◆━━━━━━━━━━━━━━━━━━◇ [AI Generation]
              70%                30%
         140K FLOPS          60K FLOPS
         → 140K LoC/s exec   → 18K LoC/s written
```

- **Left = Execution.** All FLOPS run code. Cash flows, but LoC dries up fast.
- **Right = AI Generation.** LoC piles up, but nothing executes. No cash.
- **Sweet spot:** somewhere in the middle, always shifting as you buy upgrades.

The slider is the late-game equivalent of the keyboard — your main interaction loop shifts from mashing keys to tuning allocation. Pre-AI it's hidden, keeps things simple.

---

## Progression Tiers

### Tier 0 — The Garage (0 - $100)

You're alone. A keyboard and a dream.

| Upgrade | Cost | Effect | Max |
|---------|------|--------|-----|
| Better Keyboard | $10 | +1 LoC per keystroke | 5 |
| Energy Drink | $20 | +2 LoC per keystroke (temporary? or permanent) | 10 |
| Old Laptop | $0 (starter) | 1 FLOP (executes 1 LoC/s) | — |
| RAM Upgrade | $30 | +2 FLOPS | 5 |
| SSD | $75 | +5 FLOPS | 3 |

**Cash per LoC executed:** $0.01

**Unlocks at end:** "Freelancing" (Tier 1)

---

### Tier 1 — Freelancing ($100 - $2,000)

You're selling your code. Clients appear.

| Upgrade | Cost | Effect | Max |
|---------|------|--------|-----|
| Stack Overflow Premium | $100 | +5 LoC/keystroke | 3 |
| Second Monitor | $150 | +10 FLOPS | 5 |
| Mechanical Keyboard | $300 | LoC/keystroke x2 multiplier | 1 |
| Desktop PC | $500 | +50 FLOPS | 3 |
| Coffee Machine | $200 | +20% LoC production speed | 1 |

**Cash per LoC executed:** $0.05 (clients pay more)

**Unlocks at end:** "Startup" (Tier 2)

---

### Tier 2 — Startup ($2K - $50K)

You have a company now. Time to hire.

| Upgrade | Cost | Effect | Max |
|---------|------|--------|-----|
| Intern | $2,000 | Auto-writes 2 LoC/s | 5 |
| Junior Dev | $5,000 | Auto-writes 10 LoC/s | 10 |
| CI/CD Pipeline | $3,000 | +100 FLOPS | 3 |
| Cloud Server | $8,000 | +500 FLOPS | 5 |
| Senior Dev | $20,000 | Auto-writes 50 LoC/s | 5 |
| Office Space | $10,000 | All devs +25% speed | 1 |

**Cash per LoC executed:** $0.25

**Unlocks at end:** "Tech Company" (Tier 3)

---

### Tier 3 — Tech Company ($50K - $5M)

You're scaling. The product prints money.

| Upgrade | Cost | Effect | Max |
|---------|------|--------|-----|
| Dev Team (x10) | $50K | Auto-writes 200 LoC/s | 10 |
| GPU Cluster | $200K | +10,000 FLOPS | 5 |
| Architect | $100K | LoC execution yields x2 cash | 3 |
| Open Source Community | $150K | Auto-writes 500 LoC/s (free labor) | 1 |
| Data Center | $500K | +100,000 FLOPS | 3 |
| Series A Funding | $1M | Immediate $2M cash injection | 1 |

**Cash per LoC executed:** $1.00

**Unlocks at end:** "AI Lab" (Tier 4)

---

### Tier 4 — AI Lab ($5M - $1B)

You've pivoted to AI. The code starts writing itself — but it eats your compute.
Each AI model is a distinct "flavor" with real personality. You can run multiple simultaneously.

#### AI Models

Each model has: **LoC/s** (output speed), **FLOPS cost**, **Code Quality modifier**, and a **Special trait**.
Upgrading a model to the next version increases LoC/s but FLOPS cost scales *slower* — the efficiency play.

| Model | Version | Cost | LoC/s | FLOPS cost | Quality | Special | Max |
|-------|---------|------|-------|------------|---------|---------|-----|
| **Claude** | Sonnet | $5M | 5K | 2K | 95% | "Refuses to write spaghetti" — won't go below 80% quality | 1 |
| **Claude** | Opus | $30M | 20K | 6K | 98% | Can self-review: +5% quality to all AI output | 1 |
| **GPT** | GPT-4 | $8M | 8K | 3K | 85% | Verbose: +30% LoC/s but lines are 30% fluff | 1 |
| **GPT** | GPT-5 | $40M | 60K | 15K | 88% | "I'm sorry, I can't—" just kidding, it writes everything | 1 |
| **Gemini** | Pro | $6M | 6K | 2.5K | 80% | Multimodal: can write both frontend AND backend (x2 cash) | 1 |
| **Gemini** | Ultra | $35M | 40K | 10K | 82% | Sometimes hallucinates: 5% chance LoC does nothing on execution | 1 |
| **Llama** | 70B | $3M | 3K | 1K | 75% | Open source: no license fee, cheapest FLOPS cost | 1 |
| **Llama** | 405B | $15M | 25K | 5K | 78% | Community patches: quality improves +1%/min (caps at 90%) | 1 |
| **Mistral** | Large | $4M | 4K | 1.5K | 82% | "Le code": +10% speed bonus if you also own Coffee Machine | 1 |
| **Grok** | 2 | $10M | 12K | 4K | 70% | Chaotic: LoC output fluctuates ±50% randomly every 10s | 1 |
| **Grok** | 3 | $50M | 80K | 18K | 72% | "Based": occasionally generates meme comments (no cash value, but funny) | 1 |

#### Agent Orchestration (unlocks when you own 3+ AI models)

Combine models into agent pipelines. Each agent setup uses the models you own.

| Agent Setup | Effect | FLOPS cost |
|-------------|--------|------------|
| **Writer + Reviewer** | One model writes, another reviews. Quality = average of both +10% | Sum of both models |
| **Swarm** | All owned models write in parallel. Raw throughput. | Sum of all models |
| **Pipeline** | Chain 3 models: draft → refine → optimize. LoC output = slowest model, but quality = best model +15% | Sum of 3 models x0.8 |
| **Tournament** | Two models race, best output kept. LoC = faster model, quality = better model | Sum of both models x1.5 (waste!) |

#### Other Tier 4 Upgrades

| Upgrade | Cost | Effect | FLOPS cost | Max |
|---------|------|--------|------------|-----|
| TPU Pod | $50M | +10M FLOPS | — | 5 |
| ML Research Team | $30M | All AI LoC output x2 | — | 3 |
| Training Pipeline | $100M | +100M FLOPS | — | 3 |
| Fine-Tuning Lab | $75M | All AI quality +5% | 5K FLOPS | 1 |

**Cash per LoC executed:** $5.00

**Unlocks at end:** "AGI Race" (Tier 5)

---

### Tier 5 — AGI Race ($1B+)

The endgame. You're not writing code anymore. The AI is. And it's hungry for FLOPS.

| Upgrade | Cost | Effect | FLOPS cost | Max |
|---------|------|--------|------------|-----|
| Superintelligent Coder | $1B | Auto-writes 1M LoC/s | 500K FLOPS | 3 |
| Dyson Sphere (partial) | $10B | +1T FLOPS | — | 1 |
| Self-Improving AI | $50B | AI output doubles every 60s | Doubles every 60s too | 1 |
| Alignment Tax | $5B | Required to prevent game over | 100K FLOPS (constant drain) | 1 |
| The Singularity | $100B | You win. Or do you? | ALL OF THEM | 1 |

**Cash per LoC executed:** $50.00

---

## Special Mechanics

### Code Quality

Quality is a percentage (0–100%) that acts as a **cash multiplier** on executed LoC.

```
Effective cash per LoC = base_rate × quality%
```

**How quality changes:**
- **Manual typing** is always 100% quality (you're a careful coder)
- **Human devs** (Tier 2-3) produce 90% quality
- **AI models** each have their own quality rating (see Tier 4)
- **Quality degrades over time** as codebase grows — tech debt accumulates
- Quality is a weighted average across all LoC in the queue

**Player actions to manage quality:**
- **Code Review** (manual click): Spend 10s reviewing — removes 10% of queued LoC but boosts remaining quality by +15%
- **Refactor** (upgrade): Continuously removes 5% of LoC/s from queue but keeps quality above a floor
- **Testing Suite** (upgrade): Prevents quality from dropping below a threshold (50/60/70% per level)
- **Delete Spaghetti** (manual click): Nuke X% of the LoC queue. Instant quality boost. Satisfying.

**The trap:** AI models produce LoC fast but at lower quality. If you let quality tank,
your cash per LoC craters and you're generating millions of worthless lines.
The player who just maxes AI output without managing quality will stall hard.

**Visual feedback:** The code in the editor visually degrades as quality drops —
clean syntax highlighting at 100%, increasingly messy/commented-out/TODO-riddled at low quality.

### Tech Debt
Accumulated LoC without execution starts generating "debt" — a slow drain.
Forces you to keep FLOPS balanced with LoC production.

### Prestige: "Rewrite"
When you reach AGI, you can "Rewrite from scratch" — reset with a permanent multiplier.
Each rewrite gives you a "paradigm shift" bonus.

### Events (random popups)
- **"Production is down!"** — FLOPS halved for 30s unless you click fast
- **"Hackathon!"** — Double LoC for 20s
- **"Investor Demo"** — Bonus cash if your LoC/s is above threshold
- **"Stack Overflow is down"** — Lose autocomplete bonuses for 15s
- **"GitHub Star"** — Small random cash bonus

### The Code Editor (left panel)
- Shows real-looking code being "typed" (hackertyper style)
- Code visually changes per tier (Python → ML code → abstract AI code → alien symbols)
- Executed lines fade out / get consumed with a visual effect
- Unexecuted lines pile up visually when FLOPS are bottlenecked

---

## UI Layout

```
┌─────────────────────────────────┬──────────────────┐
│                                 │  [$] Cash         │
│    CODE EDITOR                  │  [< >] LoC Queue  │
│    (hackertyper)                │  [⚡] FLOPS       │
│                                 │                    │
│    Lines appear as typed/       │  ── Upgrades ──    │
│    auto-generated               │  [Buy] [Buy] ...   │
│                                 │                    │
│    Executed lines fade out      │  ── Milestones ──  │
│    with visual effect           │  [x] Hello World   │
│                                 │  [ ] Startup       │
│                                 │  [ ] ...           │
│                                 │                    │
│    ┌──────────────────────┐     │  ── Events ──      │
│    │ progress/exec bar    │     │  (random popups)   │
│    └──────────────────────┘     │                    │
└─────────────────────────────────┴──────────────────┘
```

---

## Tone

Satirical but affectionate. We're making fun of the tech industry, the AI hype cycle,
the grind of software development — but from inside it. The humor is self-aware.

The endgame question: did you build AGI, or did AGI build you?

---

## Open Questions

- ~~Should FLOPS be bought directly or only through hardware?~~ → Through hardware. FLOPS are always a physical thing you own.
- ~~Should there be a FLOPS allocation slider (execution vs AI) or automatic split?~~ → Slider. Player controls the split.
- ~~Should there be a "bug rate" that increases with auto-generated code?~~ → Replaced by Code Quality system. AI quality varies by model.
- ~~Multiplayer / leaderboard?~~ → Later. GitHub-integrated leaderboard as a way to drive stars/engagement. Players auth with GitHub, scores on a public board.
- ~~Mobile support?~~ → Adapt, don't port. No keyboard on mobile so replace typing with a tap mechanic (tap-to-commit? swipe-to-merge?). Sidebar becomes bottom sheet. Stretch goal but worth designing for early in the layout.
- Sound design? (keyboard clicks, cash register, server hum)
- ~~Save system?~~ → localStorage. Auto-save every 30s + on tab close. Import/export as base64 string for sharing.
