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
					{"💼 "}
					{t("prestige_modal.title")}
				</div>
				<div
					css={css({
						fontSize: 12,
						color: theme.textMuted,
						marginBottom: 16,
					})}
				>
					{t("prestige_modal.subtitle")}
				</div>

				<div css={css({ marginBottom: 12 })}>
					<div
						css={css({
							fontSize: 12,
							color: theme.success,
							marginBottom: 4,
						})}
					>
						{"✅ "}
						{t("prestige_modal.pro_cash", {
							amount: formatNumber(keptCash),
						})}
					</div>
					<div
						css={css({
							fontSize: 12,
							color: theme.success,
							marginBottom: 4,
						})}
					>
						{"✅ "}
						{t("prestige_modal.pro_experience", {
							current: prestigeMultiplier.toFixed(1),
							next: nextMult.toFixed(1),
						})}
					</div>
					<div
						css={css({
							fontSize: 12,
							color: theme.success,
							marginBottom: 4,
						})}
					>
						{"✅ "}
						{t("prestige_modal.pro_reputation", {
							currentStars,
							nextStars,
						})}
					</div>
				</div>

				<div css={css({ marginBottom: 20 })}>
					<div
						css={css({
							fontSize: 12,
							color: "#f44336",
							marginBottom: 4,
						})}
					>
						{"❌ "}
						{t("prestige_modal.con_restart")}
					</div>
					<div
						css={css({
							fontSize: 12,
							color: "#f44336",
							marginBottom: 4,
						})}
					>
						{"❌ "}
						{t("prestige_modal.con_employees")}
					</div>
					<div
						css={css({
							fontSize: 12,
							color: "#f44336",
							marginBottom: 4,
						})}
					>
						{"❌ "}
						{t("prestige_modal.con_tech")}
					</div>
				</div>

				<div
					css={css({
						display: "flex",
						justifyContent: "space-between",
						gap: 12,
					})}
				>
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
