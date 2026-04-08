# Player Feedback Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub Stars event reward, rework singularity endgame flow, add `sudo godmode` easter egg, and add prestige confirmation modal with acquisition framing.

**Architecture:** Four independent changes — (1) add `currentTierIndex` to expression context and fix event reward, (2) add `endgameCompleted` state and rework singularity X button, (3) add `sudo` command to terminal, (4) new prestige modal component with i18n. Changes 2 and 3 share the `endgameCompleted` field.

**Tech Stack:** React 19, Zustand, Emotion, i18next, TypeScript strict mode, ts-pattern

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `libs/domain/types/event.ts` | Modify | Add `currentTierIndex` to `ExpressionContext` |
| `libs/engine/expression.ts` | Modify | Handle `currentTierIndex` in `lookupVariable` |
| `apps/game/src/modules/game/hooks/use-game-loop.ts` | Modify | Populate `ctx.currentTierIndex` |
| `libs/domain/data/events.json` | Modify | Fix `github_star` reward value |
| `apps/game/src/modules/game/store/game-store.ts` | Modify | Add `endgameCompleted` field, preserve in reset/prestige |
| `apps/game/src/modules/game/components/singularity-sequence.tsx` | Modify | Disable X before rickroll, pulse after, new dismiss handler |
| `apps/game/src/app.tsx` | Modify | Change godmode gate to `endgameCompleted` |
| `apps/game/src/modules/terminal/shell-engine.ts` | Modify | Add `sudo` command handling |
| New: `apps/game/src/components/prestige-modal.tsx` | Create | Acquisition offer confirmation modal |
| `apps/game/src/modules/event/components/event-toast.tsx` | Modify | Show modal instead of direct prestige call |
| `apps/game/src/components/status-bar.tsx` | Modify | Update prestige label |
| `apps/game/src/modules/editor/components/streaming-editor.tsx` | Modify | Show hint comment after endgame |
| `apps/game/src/i18n/locales/*/ui.json` (8 files) | Modify | Modal text, sudo output, status bar label, hint |

---

### Task 1: Add `currentTierIndex` to expression context and fix GitHub Stars

**Files:**
- Modify: `libs/domain/types/event.ts`
- Modify: `libs/engine/expression.ts`
- Modify: `apps/game/src/modules/game/hooks/use-game-loop.ts`
- Modify: `libs/domain/data/events.json`

- [ ] **Step 1: Add `currentTierIndex` to `ExpressionContext`**

In `libs/domain/types/event.ts`, line 116-120, change:

```typescript
export interface ExpressionContext {
	currentCash: number;
	currentLoc: number;
	currentLocPerSec: number;
	currentTierIndex: number;
}
```

- [ ] **Step 2: Handle `currentTierIndex` in expression resolver**

In `libs/engine/expression.ts`, add to the `lookupVariable` function (after line 39):

```typescript
if (name === "currentTierIndex") return ctx.currentTierIndex;
```

- [ ] **Step 3: Populate `currentTierIndex` in game loop**

In `apps/game/src/modules/game/hooks/use-game-loop.ts`, after line 50 (`ctx.currentLocPerSec = ...`), add:

```typescript
ctx.currentTierIndex = gameState.currentTierIndex;
```

Also update the `ctx` object initialization (line 18-22) to include the new field:

```typescript
const ctx: ExpressionContext = {
	currentCash: 0,
	currentLoc: 0,
	currentLocPerSec: 0,
	currentTierIndex: 0,
};
```

- [ ] **Step 4: Fix `github_star` event reward**

In `libs/domain/data/events.json`, find the `github_star` event and change its effect value from:

```json
{ "type": "instantCash", "op": "add", "value": "currentCash * 0.02" }
```

To:

```json
{ "type": "instantCash", "op": "add", "value": "20 + currentTierIndex * 40" }
```

This gives $20 at T0, $60 at T1, $100 at T2.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/domain/types/event.ts libs/engine/expression.ts apps/game/src/modules/game/hooks/use-game-loop.ts libs/domain/data/events.json
git commit -m "🐛 Fix GitHub Stars event: flat tier-scaled cash instead of invisible percentage"
```

---

### Task 2: Add `endgameCompleted` to game store

**Files:**
- Modify: `apps/game/src/modules/game/store/game-store.ts`

- [ ] **Step 1: Add `endgameCompleted` to `GameState` interface**

Add after `hasReachedSingularity: boolean` (around line 132):

```typescript
endgameCompleted: boolean;
```

- [ ] **Step 2: Add initial value**

In `initialState`, add after the `hasReachedSingularity` initial value:

```typescript
endgameCompleted: false,
```

- [ ] **Step 3: Preserve `endgameCompleted` in the `reset` action**

In the `reset` action (line 916-927), add `endgameCompleted` to the preserved fields:

```typescript
reset: () => {
	const { prestigeCount, prestigeMultiplier, hasReachedSingularity, endgameCompleted } =
		get();
	set({
		...initialState,
		prestigeCount,
		prestigeMultiplier,
		hasReachedSingularity,
		endgameCompleted,
	});
	localStorage.removeItem("flopsed-editor");
	useEventStore.getState().reset();
},
```

- [ ] **Step 4: Preserve `endgameCompleted` in the `prestige` action**

In the `prestige` action (line 929-944), preserve `endgameCompleted`:

```typescript
prestige: () => {
	const s = get();
	if (s.prestigeCount >= 5) return;
	const keptCash = s.cash * 0.05;
	const newCount = s.prestigeCount + 1;
	const newMult = 1.7 ** newCount;
	set({
		...initialState,
		prestigeCount: newCount,
		prestigeMultiplier: newMult,
		cash: keptCash,
		totalCash: keptCash,
		endgameCompleted: s.endgameCompleted,
	});
	localStorage.removeItem("flopsed-editor");
	useEventStore.getState().reset();
},
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/modules/game/store/game-store.ts
git commit -m "✨ Add endgameCompleted state field (preserved across reset/prestige)"
```

---

### Task 3: Rework singularity sequence X button

**Files:**
- Modify: `apps/game/src/modules/game/components/singularity-sequence.tsx`
- Modify: `apps/game/src/app.tsx`

- [ ] **Step 1: Add pulsing animation CSS**

In `singularity-sequence.tsx`, add a keyframe animation near the top of the file (after the existing CSS, around line 115):

```typescript
const pulseRedDot = keyframes`
	0%, 100% { box-shadow: 0 0 0 0 rgba(255, 95, 87, 0.6); }
	50% { box-shadow: 0 0 8px 3px rgba(255, 95, 87, 0.8); }
`;
```

- [ ] **Step 2: Track rickroll completion**

In the `SingularitySequence` component, add a state to track whether the rickroll has played. After the existing `phase` state:

```typescript
const [rickrollPlayed, setRickrollPlayed] = useState(false);
```

Add an effect that sets `rickrollPlayed` after being in the rickroll phase for a few seconds (enough time to confirm the rickroll loaded):

```typescript
useEffect(() => {
	if (phase !== PhaseEnum.rickroll) return;
	const timer = setTimeout(() => setRickrollPlayed(true), 5000);
	return () => clearTimeout(timer);
}, [phase]);
```

- [ ] **Step 3: Update the rickroll phase to show the exit button**

In the rickroll phase rendering (around line 587-598), change from just the iframe to include an overlay exit button that appears after `rickrollPlayed`:

```tsx
if (phase === PhaseEnum.rickroll) {
	return (
		<div css={rickrollOverlayCss}>
			<iframe
				css={rickrollVideoCss}
				src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&start=0"
				title="The Answer"
				allow="autoplay; encrypted-media"
				allowFullScreen
			/>
			{rickrollPlayed && (
				<button
					type="button"
					onClick={() => {
						const store = useGameStore.getState();
						set({ endgameCompleted: true, singularity: false });
					}}
					css={css({
						position: "absolute",
						top: 12,
						left: 12,
						width: 14,
						height: 14,
						borderRadius: "50%",
						background: "#ff5f57",
						border: "none",
						cursor: "pointer",
						animation: `${pulseRedDot} 1.5s ease-in-out infinite`,
						zIndex: 10,
						"&:hover": { filter: "brightness(1.2)" },
					})}
					title="Exit"
				/>
			)}
		</div>
	);
}
```

Note: Use `useGameStore.setState` instead of the store's `set` since we're in a component, not inside the store. The actual implementation:

```typescript
onClick={() => {
	useGameStore.setState({ endgameCompleted: true, singularity: false });
}}
```

- [ ] **Step 4: Disable the X button before rickroll**

In the top bar section (around line 612-620), replace the existing red dot button:

```tsx
<span
	css={[
		trafficDotBtnCss,
		{ background: "#ff5f57" },
		{ cursor: "default", "&:hover": { filter: "none" } },
	]}
	title="No escape"
/>
```

Change it from a `<button>` to a `<span>` — no click handler, no pointer cursor. The button styling (`trafficDotBtnCss`) can stay but we override cursor.

- [ ] **Step 5: Update godmode gate in `app.tsx`**

In `apps/game/src/app.tsx`, change line 1173-1175 from:

```typescript
const hasReachedSingularity = useGameStore((s) => s.hasReachedSingularity);
const showGodMode =
	hasReachedSingularity || location.hostname === "localhost";
```

To:

```typescript
const endgameCompleted = useGameStore((s) => s.endgameCompleted);
const showGodMode =
	endgameCompleted || location.hostname === "localhost";
```

Remove the `hasReachedSingularity` selector if it's no longer used elsewhere in this component.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/modules/game/components/singularity-sequence.tsx apps/game/src/app.tsx
git commit -m "✨ Rework singularity endgame: disable X before rickroll, pulse after, no reset"
```

---

### Task 4: Add `sudo godmode` terminal command

**Files:**
- Modify: `apps/game/src/modules/terminal/shell-engine.ts`
- Modify: `apps/game/src/i18n/locales/*/ui.json` (8 files)

- [ ] **Step 1: Add i18n keys for sudo output**

In `en/ui.json`, add a `terminal` section (or add to existing):

```json
"terminal": {
	"sudo_godmode": "root access granted. You cheater.",
	"sudo_denied": "Permission denied. Nice try."
}
```

Add translations for all 8 locales:

**French:** `"sudo_godmode": "Accès root accordé. Tricheur."`, `"sudo_denied": "Permission refusée. Bien tenté."`

**German:** `"sudo_godmode": "Root-Zugriff gewährt. Du Schummler."`, `"sudo_denied": "Zugriff verweigert. Netter Versuch."`

**Spanish:** `"sudo_godmode": "Acceso root concedido. Tramposo."`, `"sudo_denied": "Permiso denegado. Buen intento."`

**Italian:** `"sudo_godmode": "Accesso root concesso. Imbroglione."`, `"sudo_denied": "Permesso negato. Bel tentativo."`

**Polish:** `"sudo_godmode": "Dostęp root przyznany. Oszuście."`, `"sudo_denied": "Brak uprawnień. Niezły pomysł."`

**Chinese:** `"sudo_godmode": "已获取 root 权限。你个作弊者。"`, `"sudo_denied": "权限被拒绝。想得美。"`

**Russian:** `"sudo_godmode": "Root-доступ получен. Читер."`, `"sudo_denied": "Отказано в доступе. Хорошая попытка."`

- [ ] **Step 2: Add `sudo` handler to shell engine**

In `apps/game/src/modules/terminal/shell-engine.ts`, in the `execute` method, add sudo handling before the `COMMANDS[name]` lookup (after line 106, before line 108):

```typescript
if (name === "sudo") {
	const subCmd = args.join(" ");
	if (subCmd === "godmode") {
		useGameStore.getState().setState({ endgameCompleted: true });
		// Switch to godmode tab
		const { PageEnum } = await import("@modules/game");
		useUiStore.getState().setActivePage(PageEnum.god_mode);
		allLines.push({
			type: ShellLineTypeEnum.output,
			text: i18n.t("terminal.sudo_godmode"),
		});
		break;
	}
	allLines.push({
		type: ShellLineTypeEnum.error,
		text: i18n.t("terminal.sudo_denied"),
	});
	break;
}
```

Note: The shell engine uses `useGameStore` already (imported at top). We need to also set the game state directly. Since the store's `set` is internal, use `useGameStore.setState()` (Zustand's external API).

Check how the shell engine accesses stores — it already imports `useGameStore` at line 3. We need to add imports for `useUiStore` and `i18n`. Look at how i18n is used in other terminal commands — if it's not, use the English strings directly (the terminal is English-only per CLAUDE.md: "CLI prompt cosmetic output" stays in English).

Per CLAUDE.md, terminal output stays in English. So skip i18n for this and use hardcoded strings:

```typescript
if (name === "sudo") {
	const subCmd = args.join(" ");
	if (subCmd === "godmode") {
		useGameStore.setState({ endgameCompleted: true });
		allLines.push({
			type: ShellLineTypeEnum.output,
			text: "root access granted. You cheater.",
		});
		break;
	}
	allLines.push({
		type: ShellLineTypeEnum.error,
		text: "Permission denied. Nice try.",
	});
	break;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/modules/terminal/shell-engine.ts
git commit -m "✨ Add hidden sudo godmode easter egg terminal command"
```

---

### Task 5: Show "sudo godmode" hint in editor after endgame

**Files:**
- Modify: `apps/game/src/modules/editor/components/streaming-editor.tsx`

- [ ] **Step 1: Add hint comment after endgame**

In `streaming-editor.tsx`, read `endgameCompleted` from the store and show a comment line in the status bar area. After the existing status bar (around line 293-296), add a hint line:

```tsx
const endgameCompleted = useGameStore((s) => s.endgameCompleted);
```

Add this selector at the top of the component (alongside other selectors like `locPerKey`, `addLoc`, `running`).

Then after the status bar `<div>` (after line 296), add:

```tsx
{endgameCompleted && (
	<div
		css={css({
			fontSize: 10,
			color: theme.comment,
			fontStyle: "italic",
			padding: "2px 12px",
			opacity: 0.7,
		})}
	>
		{"// hint: You could have bypassed this whole grind by just running \"sudo godmode\""}
	</div>
)}
```

Need to also get `theme` — check if `useIdeTheme` is already called in this component. If not, import and call it.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/editor/components/streaming-editor.tsx
git commit -m "✨ Show sudo godmode hint in editor after endgame completion"
```

---

### Task 6: Create prestige confirmation modal

**Files:**
- Create: `apps/game/src/components/prestige-modal.tsx`
- Modify: `apps/game/src/i18n/locales/*/ui.json` (8 files)

- [ ] **Step 1: Add i18n keys for modal text**

In `en/ui.json`, add a `prestige_modal` section:

```json
"prestige_modal": {
	"title": "Acquisition Offer",
	"subtitle": "A corporation wants to buy your company.",
	"pro_cash": "Walk away with ${{amount}} cash",
	"pro_experience": "Experience gained: {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Reputation: {{currentStars}} → {{nextStars}}",
	"con_restart": "Start over from The Garage",
	"con_employees": "All employees, hardware & AI lost",
	"con_tech": "All tech research wiped",
	"cancel": "Keep working",
	"confirm": "Sell out"
}
```

**French:**
```json
"prestige_modal": {
	"title": "Offre d'acquisition",
	"subtitle": "Une corporation veut racheter votre entreprise.",
	"pro_cash": "Repartir avec ${{amount}} en cash",
	"pro_experience": "Expérience acquise : {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Réputation : {{currentStars}} → {{nextStars}}",
	"con_restart": "Recommencer depuis Le Garage",
	"con_employees": "Tous les employés, matériel & IA perdus",
	"con_tech": "Toute la recherche tech effacée",
	"cancel": "Continuer à bosser",
	"confirm": "Vendre"
}
```

**German:**
```json
"prestige_modal": {
	"title": "Übernahmeangebot",
	"subtitle": "Ein Konzern will Ihre Firma kaufen.",
	"pro_cash": "Gehen Sie mit ${{amount}} Cash",
	"pro_experience": "Erfahrung gewonnen: {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Reputation: {{currentStars}} → {{nextStars}}",
	"con_restart": "Neustart aus der Garage",
	"con_employees": "Alle Mitarbeiter, Hardware & KI verloren",
	"con_tech": "Alle Tech-Forschung gelöscht",
	"cancel": "Weiterarbeiten",
	"confirm": "Verkaufen"
}
```

**Spanish:**
```json
"prestige_modal": {
	"title": "Oferta de adquisición",
	"subtitle": "Una corporación quiere comprar tu empresa.",
	"pro_cash": "Llévatе ${{amount}} en cash",
	"pro_experience": "Experiencia ganada: {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Reputación: {{currentStars}} → {{nextStars}}",
	"con_restart": "Empezar desde El Garaje",
	"con_employees": "Todos los empleados, hardware e IA perdidos",
	"con_tech": "Toda la investigación tech borrada",
	"cancel": "Seguir trabajando",
	"confirm": "Vender"
}
```

**Italian:**
```json
"prestige_modal": {
	"title": "Offerta di acquisizione",
	"subtitle": "Una corporation vuole comprare la tua azienda.",
	"pro_cash": "Vai via con ${{amount}} in contanti",
	"pro_experience": "Esperienza guadagnata: {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Reputazione: {{currentStars}} → {{nextStars}}",
	"con_restart": "Ricominciare dal Garage",
	"con_employees": "Tutti i dipendenti, hardware e IA persi",
	"con_tech": "Tutta la ricerca tech cancellata",
	"cancel": "Continuare a lavorare",
	"confirm": "Vendere"
}
```

**Polish:**
```json
"prestige_modal": {
	"title": "Oferta przejęcia",
	"subtitle": "Korporacja chce kupić Twoją firmę.",
	"pro_cash": "Odejdź z ${{amount}} gotówki",
	"pro_experience": "Zdobyte doświadczenie: {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Reputacja: {{currentStars}} → {{nextStars}}",
	"con_restart": "Zacznij od nowa z Garażu",
	"con_employees": "Wszyscy pracownicy, sprzęt i AI stracone",
	"con_tech": "Wszystkie badania tech usunięte",
	"cancel": "Pracować dalej",
	"confirm": "Sprzedać"
}
```

**Chinese:**
```json
"prestige_modal": {
	"title": "收购要约",
	"subtitle": "一家公司想要收购你的企业。",
	"pro_cash": "带走 ${{amount}} 现金",
	"pro_experience": "获得经验：{{current}}x → {{next}}x $/LoC",
	"pro_reputation": "声望：{{currentStars}} → {{nextStars}}",
	"con_restart": "从车库重新开始",
	"con_employees": "所有员工、硬件和 AI 全部失去",
	"con_tech": "所有技术研究被清除",
	"cancel": "继续工作",
	"confirm": "卖掉"
}
```

**Russian:**
```json
"prestige_modal": {
	"title": "Предложение о покупке",
	"subtitle": "Корпорация хочет купить вашу компанию.",
	"pro_cash": "Уйти с ${{amount}} наличными",
	"pro_experience": "Опыт получен: {{current}}x → {{next}}x $/LoC",
	"pro_reputation": "Репутация: {{currentStars}} → {{nextStars}}",
	"con_restart": "Начать заново из Гаража",
	"con_employees": "Все сотрудники, оборудование и ИИ потеряны",
	"con_tech": "Все технические исследования стёрты",
	"cancel": "Продолжить работу",
	"confirm": "Продать"
}
```

- [ ] **Step 2: Create `prestige-modal.tsx`**

Create `apps/game/src/components/prestige-modal.tsx`:

```tsx
import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

interface PrestigeModalProps {
	onConfirm: () => void;
	onCancel: () => void;
}

export function PrestigeModal({ onConfirm, onCancel }: PrestigeModalProps) {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const cash = useGameStore((s) => s.cash);
	const prestigeCount = useGameStore((s) => s.prestigeCount);
	const prestigeMultiplier = useGameStore((s) => s.prestigeMultiplier);

	const keptCash = cash * 0.05;
	const nextCount = prestigeCount + 1;
	const nextMult = 1.7 ** nextCount;
	const currentStars = "★".repeat(prestigeCount) || "—";
	const nextStars = "★".repeat(nextCount);

	return (
		<div
			css={css({
				position: "fixed",
				inset: 0,
				zIndex: 9999,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(0,0,0,0.7)",
			})}
			onClick={onCancel}
			onKeyDown={undefined}
			role="presentation"
		>
			<div
				css={css({
					background: theme.panelBg,
					border: `1px solid ${theme.border}`,
					borderRadius: 8,
					padding: "24px 28px",
					maxWidth: 400,
					width: "90%",
					color: theme.foreground,
					fontFamily: "inherit",
				})}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={undefined}
				role="dialog"
			>
				<div css={css({ fontSize: 16, fontWeight: 700, marginBottom: 4 })}>
					{"💼 "}{t("prestige_modal.title")}
				</div>
				<div css={css({ fontSize: 12, color: theme.textMuted, marginBottom: 16 })}>
					{t("prestige_modal.subtitle")}
				</div>

				{/* Pros */}
				<div css={css({ marginBottom: 12 })}>
					<div css={css({ fontSize: 12, color: theme.success, marginBottom: 4 })}>
						{"✅ "}{t("prestige_modal.pro_cash", { amount: formatNumber(keptCash) })}
					</div>
					<div css={css({ fontSize: 12, color: theme.success, marginBottom: 4 })}>
						{"✅ "}{t("prestige_modal.pro_experience", {
							current: prestigeMultiplier.toFixed(1),
							next: nextMult.toFixed(1),
						})}
					</div>
					<div css={css({ fontSize: 12, color: theme.success, marginBottom: 4 })}>
						{"✅ "}{t("prestige_modal.pro_reputation", {
							currentStars,
							nextStars,
						})}
					</div>
				</div>

				{/* Cons */}
				<div css={css({ marginBottom: 20 })}>
					<div css={css({ fontSize: 12, color: "#f44336", marginBottom: 4 })}>
						{"❌ "}{t("prestige_modal.con_restart")}
					</div>
					<div css={css({ fontSize: 12, color: "#f44336", marginBottom: 4 })}>
						{"❌ "}{t("prestige_modal.con_employees")}
					</div>
					<div css={css({ fontSize: 12, color: "#f44336", marginBottom: 4 })}>
						{"❌ "}{t("prestige_modal.con_tech")}
					</div>
				</div>

				{/* Buttons */}
				<div css={css({ display: "flex", justifyContent: "space-between", gap: 12 })}>
					<button
						type="button"
						css={css({
							flex: 1,
							padding: "8px 16px",
							border: `1px solid ${theme.border}`,
							borderRadius: 4,
							background: "transparent",
							color: theme.foreground,
							cursor: "pointer",
							fontSize: 12,
							"&:hover": { background: theme.border },
						})}
						onClick={onCancel}
					>
						{t("prestige_modal.cancel")}
					</button>
					<button
						type="button"
						css={css({
							flex: 1,
							padding: "8px 16px",
							border: "none",
							borderRadius: 4,
							background: "#d29922",
							color: "#000",
							cursor: "pointer",
							fontWeight: 700,
							fontSize: 12,
							"&:hover": { filter: "brightness(1.1)" },
						})}
						onClick={onConfirm}
					>
						{t("prestige_modal.confirm")}
					</button>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/components/prestige-modal.tsx apps/game/src/i18n/locales/*/ui.json
git commit -m "✨ Create prestige confirmation modal (acquisition offer framing, 8 locales)"
```

---

### Task 7: Wire prestige modal into event toast

**Files:**
- Modify: `apps/game/src/modules/event/components/event-toast.tsx`

- [ ] **Step 1: Add modal state and render**

In `event-toast.tsx`, import the modal and add state. At the top of the file that renders the toasts (the component that contains the prestige click handler around line 310-318), add:

```typescript
import { PrestigeModal } from "@components/prestige-modal";
```

Add state for showing the modal:

```typescript
const [showPrestigeModal, setShowPrestigeModal] = useState(false);
```

- [ ] **Step 2: Replace direct prestige call with modal trigger**

Change the prestige handler (around line 312-318) from:

```typescript
if (
	chosenEffect.type === "prestige" &&
	"op" in chosenEffect &&
	chosenEffect.op === "trigger"
) {
	handleChoice(displayId, i, ctx);
	useGameStore.getState().prestige();
	return;
}
```

To:

```typescript
if (
	chosenEffect.type === "prestige" &&
	"op" in chosenEffect &&
	chosenEffect.op === "trigger"
) {
	setShowPrestigeModal(true);
	return;
}
```

Note: We defer `handleChoice` until the modal is confirmed.

- [ ] **Step 3: Render the modal**

At the end of the component's return JSX (or as a sibling to the toast list), add:

```tsx
{showPrestigeModal && (
	<PrestigeModal
		onConfirm={() => {
			setShowPrestigeModal(false);
			// Find the prestige event and handle choice
			const eventState = useEventStore.getState();
			const activePrestige = eventState.activeEvents.find((e) => {
				const def = allEvents.find((d) => d.id === e.definitionId);
				return def?.effects.some(
					(eff) => eff.type === "choice" && eff.options?.some(
						(opt) => opt.effect.type === "prestige"
					)
				);
			});
			if (activePrestige) {
				// Find the option index for prestige
				const def = allEvents.find((d) => d.id === activePrestige.definitionId);
				const choiceEffect = def?.effects.find((e) => e.type === "choice");
				if (choiceEffect && choiceEffect.type === "choice") {
					const idx = choiceEffect.options.findIndex(
						(opt) => opt.effect.type === "prestige"
					);
					if (idx >= 0) {
						handleChoice(activePrestige.definitionId, idx, ctx);
					}
				}
			}
			useGameStore.getState().prestige();
		}}
		onCancel={() => setShowPrestigeModal(false)}
	/>
)}
```

The exact wiring depends on how `handleChoice`, `displayId`, and `ctx` are scoped. The implementer should check the component structure and wire it appropriately — the key behavior is: modal confirm → call `handleChoice` for the prestige event + call `prestige()`, modal cancel → dismiss.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/modules/event/components/event-toast.tsx
git commit -m "✨ Wire prestige modal into event toast (replaces direct prestige call)"
```

---

### Task 8: Update status bar prestige label

**Files:**
- Modify: `apps/game/src/components/status-bar.tsx`
- Modify: `apps/game/src/i18n/locales/*/ui.json` (8 files)

- [ ] **Step 1: Add i18n key for experience label**

In `en/ui.json`, in the `status_bar` section, add:

```json
"experience": "experience:"
```

Translations:
- **fr:** `"experience": "expérience :"`
- **de:** `"experience": "Erfahrung:"`
- **es:** `"experience": "experiencia:"`
- **it:** `"experience": "esperienza:"`
- **pl:** `"experience": "doświadczenie:"`
- **zh:** `"experience": "经验："`
- **ru:** `"experience": "опыт:"`

- [ ] **Step 2: Update status bar display**

In `apps/game/src/components/status-bar.tsx`, change the prestige display (lines 80-91) from:

```tsx
{prestigeCount > 0 && (
	<span
		css={{
			marginLeft: 8,
			color: "#d29922",
			fontWeight: "bold",
			fontSize: 11,
		}}
	>
		{"★".repeat(prestigeCount)} {prestigeMultiplier.toFixed(1)}x
	</span>
)}
```

To:

```tsx
{prestigeCount > 0 && (
	<span
		css={{
			marginLeft: 8,
			color: "#d29922",
			fontWeight: "bold",
			fontSize: 11,
		}}
	>
		{t("status_bar.experience")} {"★".repeat(prestigeCount)} {prestigeMultiplier.toFixed(1)}x $/LoC
	</span>
)}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/components/status-bar.tsx apps/game/src/i18n/locales/*/ui.json
git commit -m "🎨 Update status bar prestige label to 'experience: ★★ X.Xx $/LoC'"
```

---

### Task 9: Run checks and final verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run linter**

Run: `npm run check`
Expected: PASS (or pre-existing warnings only)

- [ ] **Step 3: Run balance sim**

Run: `npm run sim`
Expected: All 3 profiles pass

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

Verify:
1. **GitHub Stars event** — play to T1, wait for the event, check that you get ~$60 flat cash
2. **Singularity X button** — trigger singularity via godmode, verify X is disabled during sequence, pulses after rickroll, clicking it dismisses without reset
3. **sudo godmode** — type `sudo godmode` in terminal, verify godmode tab appears
4. **Editor hint** — after endgame, check streaming editor shows the hint comment
5. **Prestige modal** — trigger prestige event, verify modal shows with pros/cons, "Sell out" triggers prestige, "Keep working" cancels
6. **Status bar** — verify `experience: ★ 1.7x $/LoC` shows after prestige

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "🐛 Final polish from smoke test"
```
