import { css } from "@emotion/react";
import { memo, useEffect, useRef } from "react";

const DIGIT_HEIGHT = 1.1; // em — matches line-height

const wrapperCss = css({
	display: "inline-flex",
	overflow: "hidden",
	lineHeight: DIGIT_HEIGHT,
	contain: "layout style",
});

const digitColCss = css({
	display: "inline-block",
	height: `${DIGIT_HEIGHT}em`,
	overflow: "hidden",
	position: "relative",
	contain: "layout style",
});

const digitStripCss = css({
	display: "flex",
	flexDirection: "column",
	transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
	willChange: "transform",
	"& > span": {
		height: `${DIGIT_HEIGHT}em`,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
});

const staticCharCss = css({
	display: "inline-block",
});

/** Invisible placeholder keeps width stable when char count shrinks */
const placeholderCss = css({
	display: "inline-block",
	width: "0.6em",
	visibility: "hidden",
});

const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const DigitColumn = memo(function DigitColumn({ digit }: { digit: string }) {
	const stripRef = useRef<HTMLDivElement>(null);
	const idx = digits.indexOf(digit);
	const offset = idx >= 0 ? idx : 0;

	useEffect(() => {
		if (stripRef.current) {
			stripRef.current.style.transform = `translateY(-${offset * DIGIT_HEIGHT}em)`;
		}
	}, [offset]);

	return (
		<span css={digitColCss}>
			<div ref={stripRef} css={digitStripCss}>
				{digits.map((d) => (
					<span key={d}>{d}</span>
				))}
			</div>
		</span>
	);
});

interface RollingNumberProps {
	value: string;
	color?: string;
}

export const RollingNumber = memo(function RollingNumber({
	value,
	color,
}: RollingNumberProps) {
	const maxLenRef = useRef(value.length);
	if (value.length > maxLenRef.current) {
		maxLenRef.current = value.length;
	}

	// Pad with invisible placeholders so width never shrinks
	const padCount = maxLenRef.current - value.length;
	const chars = value.split("");

	return (
		<span css={wrapperCss} style={color ? { color } : undefined}>
			{padCount > 0 &&
				Array.from({ length: padCount }, (_, i) => (
					<span key={`pad-${i}`} css={placeholderCss} />
				))}
			{chars.map((ch, i) => {
				const isDigit = ch >= "0" && ch <= "9";
				if (isDigit) {
					return <DigitColumn key={`${i}-d`} digit={ch} />;
				}
				return (
					<span key={`${i}-s`} css={staticCharCss}>
						{ch}
					</span>
				);
			})}
		</span>
	);
});
