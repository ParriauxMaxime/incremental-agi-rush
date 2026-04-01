import { css } from "@emotion/react";
import { type ReactNode, useCallback, useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

interface CollapsibleSectionProps {
	icon: ReactNode;
	label: string;
	value: ReactNode;
	rate?: ReactNode;
	collapsible?: boolean;
	defaultOpen?: boolean;
	children?: ReactNode;
}

const sectionCss = css({
	flexShrink: 0,
});

const headerCss = css({
	display: "flex",
	alignItems: "center",
	padding: "0 14px",
	height: 54,
	userSelect: "none",
	transition: "background 0.1s",
});

const chevronCss = css({
	fontSize: 12,
	marginRight: 8,
	transition: "transform 0.15s ease",
	display: "inline-block",
	width: 14,
	textAlign: "center",
});

const labelCss = css({
	fontSize: 15,
	flex: 1,
	display: "flex",
	alignItems: "center",
	gap: 7,
	fontWeight: 500,
});

const iconCss = css({ fontSize: 16 });

const valueCss = css({
	fontSize: 22,
	fontWeight: "bold",
	fontVariantNumeric: "tabular-nums",
	lineHeight: 1.1,
});

const rateCss = css({
	fontSize: 12,
	fontVariantNumeric: "tabular-nums",
	marginTop: 2,
	opacity: 0.7,
});

const bodyCss = css({
	overflow: "hidden",
	transition: "max-height 0.2s ease, opacity 0.15s ease",
});

const bodyInnerCss = css({
	padding: "2px 12px 10px 32px",
	fontSize: 11,
});

export function CollapsibleSection({
	icon,
	label,
	value,
	rate,
	collapsible = false,
	defaultOpen = false,
	children,
}: CollapsibleSectionProps) {
	const theme = useIdeTheme();
	const [open, setOpen] = useState(defaultOpen);

	const handleClick = useCallback(() => {
		if (collapsible) setOpen((o) => !o);
	}, [collapsible]);

	return (
		<div css={sectionCss} style={{ borderBottom: `1px solid ${theme.border}` }}>
			<div
				css={headerCss}
				style={{
					cursor: collapsible ? "pointer" : "default",
				}}
				onClick={handleClick}
			>
				{collapsible && (
					<span
						css={chevronCss}
						style={{
							color: theme.textMuted,
							transform: open ? "rotate(90deg)" : "none",
						}}
					>
						▶
					</span>
				)}
				<span css={labelCss} style={{ color: theme.textMuted }}>
					<span css={iconCss}>{icon}</span>
					{label}
				</span>
				<div style={{ textAlign: "right" }}>
					<div css={valueCss}>{value}</div>
					{rate && <div css={rateCss}>{rate}</div>}
				</div>
			</div>
			{collapsible && children && (
				<div
					css={bodyCss}
					style={{
						maxHeight: open ? 400 : 0,
						opacity: open ? 1 : 0,
					}}
				>
					<div css={bodyInnerCss}>{children}</div>
				</div>
			)}
		</div>
	);
}
