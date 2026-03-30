<div align="center">

<img src="apps/game/public/og-image.png" alt="Flopsed" width="600" />

# Flopsed

**Type code. Execute for cash. Race to AGI.**

An incremental idle game where you scale a tech company from a garage to the singularity.

[![Play Now](https://img.shields.io/badge/Play%20Now-flopsed.io-a6e22e?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik04IDV2MTRsMTEtN3oiLz48L3N2Zz4=)](https://flopsed.io)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f92672)](LICENSE)
[![i18n](https://img.shields.io/badge/i18n-8%20languages-fd971f)](#internationalization)

</div>

---

## The Game

You start in a garage, typing code on a keyboard. Every keystroke generates **Lines of Code (LoC)**. Your hardware's **FLOPS** execute that code into **Cash**. Cash buys upgrades — better hardware, hired devs, and eventually AI models that write code for you.

The twist: AI models consume FLOPS to generate code, creating a tension between execution and generation. The late game becomes a resource allocation puzzle as you race toward the singularity.

**~35 minutes** for a first playthrough.

## Progression

| Tier | Name | What happens |
|------|------|-------------|
| T0 | The Garage | Just you and a keyboard |
| T1 | Freelancing | Hire freelancers, sell your code |
| T2 | Startup | Interns, dev teams, cloud servers |
| T3 | Tech Company | Managers, GPU clusters, data centers |
| T4 | AI Lab | AI models write code — but eat your FLOPS |
| T5 | AGI Race | Superintelligent models, the final push |

## Features

- **Typing mechanic** — real keystrokes feed the code pipeline
- **Tech tree** — 60+ research nodes across 6 tiers
- **21 AI models** — from Copilot to Claude Universe, each with unique abilities
- **Dynamic events** — production outages, hackathons, viral tweets
- **Endgame sequence** — CRT collapse, terminal boot, AGI monologue
- **8 languages** — EN, FR, IT, DE, ES, PL, ZH, RU
- **8 editor themes** — Monokai, Dracula, Nord, Solarized, and more
- **Original soundtrack** — stem-based music that evolves with your tier

## Stack

| Layer | Tech |
|-------|------|
| UI | React 19 + Emotion |
| State | Zustand |
| Build | Rspack + SWC |
| Lint | Biome |
| Audio | Tone.js (music) + Web Audio API (SFX) |
| i18n | i18next + react-i18next |
| Monorepo | npm workspaces |

## Development

```bash
npm install
npm run dev          # Game dev server on :3000
npm run build        # Production build
npm run typecheck    # TypeScript strict check
npm run check        # Biome lint + format
npm run sim          # Balance simulation (3 player profiles)
npm run editor       # Data editor on :3738
```

## Project Structure

```
flopsed/
├── apps/
│   ├── game/           # Main game (React SPA)
│   ├── editor/         # Data editor (React + Express)
│   └── simulation/     # Balance simulation (CLI)
├── libs/
│   ├── domain/         # Game data + TypeScript types
│   ├── engine/         # Pure game math (no React)
│   └── design-system/  # Shared components + theme
└── specs/              # Game design doc
```

## Internationalization

The game is fully translated into 8 languages. Language is selectable in-game via flag picker in settings.

🇬🇧 English · 🇫🇷 Français · 🇮🇹 Italiano · 🇩🇪 Deutsch · 🇪🇸 Español · 🇵🇱 Polski · 🇨🇳 中文 · 🇷🇺 Русский

## License

[MIT](LICENSE)
