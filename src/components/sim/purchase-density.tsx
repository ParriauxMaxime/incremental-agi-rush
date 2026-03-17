import { css } from "@emotion/react";
import { PurchaseTypeEnum, type SimPurchase } from "@utils/balance-sim";
import { match } from "ts-pattern";

const containerCss = css({
	position: "relative",
	height: 60,
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	marginBottom: 16,
	overflow: "hidden",
});

const labelsCss = css({
	display: "flex",
	justifyContent: "space-between",
	fontSize: 10,
	color: "#484f58",
	padding: "0 4px",
	marginBottom: 4,
});

const dotCss = css({
	position: "absolute",
	width: 3,
	bottom: 0,
	borderRadius: "1px 1px 0 0",
	opacity: 0.8,
});

function dotStyle(type: SimPurchase["type"]) {
	return match(type)
		.with(PurchaseTypeEnum.tier, () => ({
			height: 60,
			background: "#c678dd",
		}))
		.with(PurchaseTypeEnum.ai, () => ({
			height: 40,
			background: "#3fb950",
		}))
		.with(PurchaseTypeEnum.upgrade, () => ({
			height: 20,
			background: "#58a6ff",
		}))
		.with(PurchaseTypeEnum.tech, () => ({
			height: 25,
			background: "#c678dd",
		}))
		.exhaustive();
}

export function PurchaseDensity({
	purchases,
	endTime,
}: {
	purchases: SimPurchase[];
	endTime: number;
}) {
	const total = Math.max(endTime, 1);
	const maxMin = Math.ceil(total / 60);

	return (
		<>
			<div css={labelsCss}>
				{Array.from({ length: Math.floor(maxMin / 5) + 1 }, (_, i) => (
					<span key={i}>{i * 5}m</span>
				))}
			</div>
			<div css={containerCss}>
				{purchases.map((p, i) => {
					const left = (p.time / total) * 100;
					const style = dotStyle(p.type);
					return (
						<div
							key={i}
							css={dotCss}
							style={{
								left: `${left}%`,
								height: style.height,
								background: style.background,
							}}
							title={`${Math.floor(p.time / 60)}:${(p.time % 60).toString().padStart(2, "0")} ${p.name}`}
						/>
					);
				})}
			</div>
		</>
	);
}
