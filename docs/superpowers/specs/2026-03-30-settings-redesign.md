# Settings Page Redesign

## Goal

Redesign the settings page into 3 clean sections: Language (flag picker), Appearance (theme preview cards + text size), Sound (two sliders). Remove the VS Code-style `category: name` pattern.

## Sections

### 1. Language
- Row of 8 flag emoji buttons: 🇬🇧 🇫🇷 🇮🇹 🇩🇪 🇪🇸 🇵🇱 🇨🇳 🇷🇺
- Active flag: accent border ring
- Tooltip: native language name ("Français", "Deutsch", etc.)
- Calls `i18n.changeLanguage(code)` on click

### 2. Appearance
- **Theme**: 2-column grid of clickable preview cards
  - Each card: theme background, 3-4 lines of syntax-highlighted fake code (`const`, `"string"`, `fn()`, `// comment`, `42`), theme name label
  - Active card: accent border + subtle glow
  - All 8 themes: One Dark, Monokai, GitHub Dark, GitHub Light, Solarized Dark, Solarized Light, Dracula, Nord
- **Text Size**: dropdown (75%–150%), same values as current zoom

### 3. Sound
- **Music**: labeled slider + percentage
- **SFX**: labeled slider + percentage
- No mute checkbox (slider to 0 = mute)

## Changes
- Rewrite `SettingsPage` in `apps/game/src/app.tsx`
- Drop `SettingItem` component (replaced by section headings + content)
- Update `en/ui.json` settings keys + all 7 other locales
- Remove mute-related settings keys (keep mute in audio store for status bar toggle)
