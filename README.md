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

You start in a garage with nothing but a keyboard. Type code, execute it for cash, and figure out the rest. How far can you scale?

**~35 minutes** for a first playthrough. No spoilers here — go play it.

## Features

- **Typing mechanic** — real keystrokes feed the code pipeline
- **Deep tech tree** — unlock new mechanics as you progress
- **Dynamic events** — surprises that shake up your strategy
- **8 languages** — EN, FR, IT, DE, ES, PL, ZH, RU
- **8 editor themes** — Monokai, Dracula, Nord, Solarized, and more
- **Original soundtrack** — music that evolves as you grow

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

## Support

If you enjoyed the game, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/parriauxmaxime)

## License

[MIT](LICENSE)
