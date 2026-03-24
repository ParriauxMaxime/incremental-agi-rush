# Simulation CLI App

**Date:** 2026-03-24
**Status:** Approved

## Problem

`specs/balance-check.js` is a standalone Node script that duplicates game logic. It doesn't use the shared `@agi-rush/engine` or `@agi-rush/domain` packages. When balancing, Claude has to parse human-readable stdout text instead of reading structured data.

## Solution

A new `apps/simulation/` CLI app that imports from `@agi-rush/engine` and `@agi-rush/domain`. Outputs structured JSON or human-readable text. Replaces `specs/balance-check.js`.

## Structure

```
apps/simulation/
├── package.json       # @agi-rush/simulation
├── tsconfig.json
└── src/
    └── main.ts        # CLI entry point
```

## Package

```json
{
  "name": "@agi-rush/simulation",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts"
  },
  "dependencies": {
    "@agi-rush/domain": "workspace:*",
    "@agi-rush/engine": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.4",
    "typescript": "^5.8.3"
  }
}
```

## CLI interface

```bash
npm run sim                  # default: human-readable, 3 profiles
npm run sim -- --verbose     # per-tier duration breakdown
npm run sim -- --json        # structured JSON output
npm run sim -- --profile casual  # single profile only
```

Exit code 0 = all checks pass, 1 = balance broken.

## Validation thresholds

Move from hardcoded constants in balance-check.js to `libs/domain/data/balance.json` under a new `validation` key:

```json
{
  "core": { ... },
  "validation": {
    "agiMinMinutes": 22,
    "agiMaxMinutes": 45,
    "maxWaitSeconds": 300,
    "minPurchases": 80,
    "maxPurchases": 500,
    "minTiers": 6,
    "tierMinDuration": {
      "garage": 30,
      "freelancing": 120,
      "startup": 120,
      "tech_company": 150,
      "ai_lab": 30,
      "agi_race": 120
    },
    "tierMaxDuration": {
      "garage": 300,
      "freelancing": 500,
      "startup": 600,
      "tech_company": 800,
      "ai_lab": 600,
      "agi_race": 720
    }
  }
}
```

## JSON output format

```json
{
  "profiles": [
    {
      "name": "casual",
      "keysPerSec": 4,
      "passed": true,
      "agiMinutes": 35.1,
      "purchases": 203,
      "longestWait": 163,
      "longestWaitItem": "Dev Team (x10)",
      "tiersReached": 6,
      "tierDurations": {
        "garage": 98,
        "freelancing": 471,
        "startup": 348,
        "tech_company": 211,
        "ai_lab": 274,
        "agi_race": 701
      },
      "failures": [],
      "aiModelsOwned": 16
    }
  ],
  "allPassed": true
}
```

## Root script

```json
"sim": "npm run start -w @agi-rush/simulation --"
```

## What gets deleted

- `specs/balance-check.js`

## Non-goals

- No web UI (editor already has a sim page)
- No watch mode
